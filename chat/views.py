from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Conversation, Message, Membership, MessagePollVote
from .serializers import (
    ConversationSerializer, ConversationCreateSerializer,
    MessageSerializer
)


class ConversationListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ConversationCreateSerializer
        return ConversationSerializer

    def get_queryset(self):
        return Conversation.objects.filter(
            participants=self.request.user
        ).prefetch_related('participants', 'messages', 'memberships')

    def get_serializer_context(self):
        return {'request': self.request}


class ConversationDetailView(generics.RetrieveAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user)


class MessageListView(generics.ListAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        conversation_id = self.kwargs['pk']
        conversation = get_object_or_404(
            Conversation, pk=conversation_id, participants=self.request.user
        )
        # Read receipt: advance this member's read cursor to now (replaces the
        # old per-message is_read bulk update).
        conversation.memberships.filter(user=self.request.user).update(
            last_read_at=timezone.now()
        )
        return conversation.messages.all().select_related('sender')


class MessageCreateView(generics.CreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        conversation = get_object_or_404(
            Conversation, pk=self.kwargs['pk'], participants=request.user
        )
        # Check broadcast channel permissions
        if conversation.conversation_type == 'channel' and conversation.channel_mode == 'broadcast':
            membership = conversation.memberships.filter(user=request.user).first()
            if not membership or membership.role != 'admin':
                return Response(
                    {'error': 'Only admins can post in broadcast channels.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(sender=request.user, conversation=conversation)
        # Update conversation timestamp
        conversation.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PublicChannelsView(generics.ListAPIView):
    serializer_class = ConversationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Conversation.objects.filter(
            conversation_type='channel',
            is_public=True
        ).prefetch_related('participants', 'messages', 'memberships')

    def get_serializer_context(self):
        return {'request': self.request}


class JoinChannelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        channel = get_object_or_404(Conversation, pk=pk, conversation_type='channel', is_public=True)
        membership, created = Membership.objects.get_or_create(
            user=request.user,
            conversation=channel,
            defaults={'role': 'member'}
        )
        if not created:
            return Response({'error': 'Already a member.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'joined'})


class LeaveConversationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        conversation = get_object_or_404(Conversation, pk=pk, participants=request.user)
        membership = get_object_or_404(Membership, user=request.user, conversation=conversation)
        membership.delete()
        return Response({'status': 'left'})


def _require_admin(conversation, user):
    """Return True if `user` is an admin of `conversation`."""
    return Membership.objects.filter(
        conversation=conversation, user=user, role='admin'
    ).exists()


class KickMemberView(APIView):
    """Admin-only: remove another member from a conversation. Minimal moderation
    (no ban, no audit log) — the kicked user can be re-added/re-invited normally."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, user_id):
        conversation = get_object_or_404(Conversation, pk=pk)
        if not _require_admin(conversation, request.user):
            return Response({'error': 'Admins only.'}, status=status.HTTP_403_FORBIDDEN)
        if int(user_id) == request.user.id:
            return Response({'error': 'Use leave to remove yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        membership = get_object_or_404(Membership, conversation=conversation, user_id=user_id)
        membership.delete()
        return Response({'status': 'kicked'})


class PromoteMemberView(APIView):
    """Admin-only: promote another member to admin. No demote in scope."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, user_id):
        conversation = get_object_or_404(Conversation, pk=pk)
        if not _require_admin(conversation, request.user):
            return Response({'error': 'Admins only.'}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(Membership, conversation=conversation, user_id=user_id)
        membership.role = 'admin'
        membership.save()
        return Response({'status': 'promoted', 'role': 'admin'})


class MessagePollVoteView(APIView):
    """Vote on a poll message. Any participant of the conversation may vote;
    re-voting updates the existing choice rather than duplicating it."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        message = get_object_or_404(
            Message, pk=pk, conversation__participants=request.user
        )
        if message.message_type != 'poll':
            return Response({'error': 'Not a poll message.'}, status=status.HTTP_400_BAD_REQUEST)
        option_index = request.data.get('option_index')
        options = (message.metadata or {}).get('options') or []
        if not isinstance(option_index, int) or not (0 <= option_index < len(options)):
            return Response({'error': 'Invalid option_index.'}, status=status.HTTP_400_BAD_REQUEST)
        vote, created = MessagePollVote.objects.update_or_create(
            user=request.user, message=message,
            defaults={'option_index': option_index}
        )
        return Response({
            'status': 'voted' if created else 'updated',
            'option_index': option_index,
        })