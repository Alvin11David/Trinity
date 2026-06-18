from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Conversation, Message, Membership
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

    def get_queryset(self):
        conversation_id = self.kwargs['pk']
        conversation = get_object_or_404(
            Conversation, pk=conversation_id, participants=self.request.user
        )
        # Mark messages as read
        conversation.messages.exclude(sender=self.request.user).update(is_read=True)
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