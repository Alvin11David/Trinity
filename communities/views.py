from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Community, CommunityMembership, CommunityPost, CommunityPostVote, CommunityRoom
from .serializers import (
    CommunitySerializer, CommunityPostSerializer, CommunityPostCreateSerializer,
    CommunityMembershipSerializer
)
from .services import sync_membership_to_channel


def _is_moderator(community, user):
    return community.memberships.filter(user=user, role='moderator').exists()


class CommunityListView(generics.ListCreateAPIView):
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Community.objects.all().prefetch_related('members', 'memberships')

    def get_serializer_context(self):
        return {'request': self.request}

    def perform_create(self, serializer):
        community = serializer.save(created_by=self.request.user)
        CommunityMembership.objects.create(
            user=self.request.user,
            community=community,
            role='moderator'
        )


class CommunityDetailView(generics.RetrieveAPIView):
    queryset = Community.objects.all()
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}


class JoinCommunityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        community = get_object_or_404(Community, pk=pk)
        membership, created = CommunityMembership.objects.get_or_create(
            user=request.user,
            community=community,
            defaults={'role': 'member'}
        )
        if not created:
            membership.delete()
            # Mirror the leave onto the linked companion channel, if any.
            sync_membership_to_channel(request.user, community, joined=False)
            return Response({'status': 'left'})
        # Mirror the join onto the linked companion channel, if any.
        sync_membership_to_channel(request.user, community, joined=True)
        return Response({'status': 'joined'})


class CommunityPostListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CommunityPostCreateSerializer
        return CommunityPostSerializer

    def get_queryset(self):
        community_id = self.kwargs['pk']
        return CommunityPost.objects.filter(
            community_id=community_id
        ).select_related('author').prefetch_related('votes')

    def get_serializer_context(self):
        community = get_object_or_404(Community, pk=self.kwargs['pk'])
        return {'request': self.request, 'community': community}


class CommunityPostDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = CommunityPostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}

    def get_queryset(self):
        return CommunityPost.objects.filter(community_id=self.kwargs['community_pk'])

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        community = post.community
        membership = community.memberships.filter(user=request.user).first()
        if post.author != request.user and (not membership or membership.role != 'moderator'):
            return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommunityPostVoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(CommunityPost, pk=pk)
        # Voting requires membership in the post's community.
        if not post.community.memberships.filter(user=request.user).exists():
            return Response(
                {'error': 'Join the community to vote.'},
                status=status.HTTP_403_FORBIDDEN
            )
        vote_type = request.data.get('vote_type')
        if vote_type not in ['up', 'down']:
            return Response({'error': 'Invalid vote type.'}, status=status.HTTP_400_BAD_REQUEST)
        vote, created = CommunityPostVote.objects.get_or_create(
            user=request.user, post=post,
            defaults={'vote_type': vote_type}
        )
        if not created:
            if vote.vote_type == vote_type:
                vote.delete()
                return Response({'status': 'removed'})
            else:
                vote.vote_type = vote_type
                vote.save()
                return Response({'status': 'updated', 'vote_type': vote_type})
        return Response({'status': 'voted', 'vote_type': vote_type})


class CommunityMembersView(generics.ListAPIView):
    """Member list with roles — the enumeration surface the kick/promote UI
    needs (communities are public, so any authenticated user may view)."""
    serializer_class = CommunityMembershipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        community = get_object_or_404(Community, pk=self.kwargs['pk'])
        return community.memberships.select_related('user').order_by('-role', 'joined_at')


class PinPostView(APIView):
    """Moderator-only toggle for CommunityPost.is_pinned — the field already
    drives sort order (-is_pinned, -created_at); this is the first API surface
    that can actually set it."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(CommunityPost, pk=pk)
        if not _is_moderator(post.community, request.user):
            return Response({'error': 'Moderators only.'}, status=status.HTTP_403_FORBIDDEN)
        post.is_pinned = not post.is_pinned
        post.save(update_fields=['is_pinned', 'updated_at'])
        return Response({'status': 'pinned' if post.is_pinned else 'unpinned'})


class KickCommunityMemberView(APIView):
    """Moderator-only: remove another member. Same minimal scope as chat's
    kick (no ban, no audit log) — the kicked user can rejoin normally."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, user_id):
        community = get_object_or_404(Community, pk=pk)
        if not _is_moderator(community, request.user):
            return Response({'error': 'Moderators only.'}, status=status.HTTP_403_FORBIDDEN)
        if int(user_id) == request.user.id:
            return Response({'error': 'Use join-toggle to leave yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        membership = get_object_or_404(CommunityMembership, community=community, user_id=user_id)
        membership.delete()
        # Mirror the removal onto the linked companion channel, if any.
        sync_membership_to_channel(membership.user, community, joined=False)
        return Response({'status': 'kicked'})


class PromoteCommunityMemberView(APIView):
    """Moderator-only: promote another member to moderator. No demote in scope."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk, user_id):
        community = get_object_or_404(Community, pk=pk)
        if not _is_moderator(community, request.user):
            return Response({'error': 'Moderators only.'}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(CommunityMembership, community=community, user_id=user_id)
        membership.role = 'moderator'
        membership.save()
        return Response({'status': 'promoted', 'role': 'moderator'})


class CreateCommunityRoomView(APIView):
    """Moderator-only enablement of a community's optional companion channel
    (CommunityRoom). Creates a chat Conversation (channel, open mode) and
    backfills every current community member into it — from then on, join/leave
    on either side stays in sync via the view-level hooks."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        community = get_object_or_404(Community, pk=pk)
        if not _is_moderator(community, request.user):
            return Response({'error': 'Moderators only.'}, status=status.HTTP_403_FORBIDDEN)
        if hasattr(community, 'room'):
            return Response({'error': 'This community already has a channel.'}, status=status.HTTP_400_BAD_REQUEST)

        from chat.models import Conversation, Membership
        conversation = Conversation.objects.create(
            conversation_type='channel',
            channel_mode='open',  # members can post — community chat, not announcements
            name=community.name,
            description=community.description[:280] if community.description else None,
            avatar=community.avatar,
            created_by=request.user,
            is_public=True,
        )
        room = CommunityRoom.objects.create(community=community, conversation=conversation)

        # Backfill: every existing community member becomes a channel member.
        # The enabling moderator gets channel admin (they created the channel);
        # everyone else joins as a plain member — roles are NOT synced.
        for cm in community.memberships.select_related('user'):
            Membership.objects.get_or_create(
                user=cm.user, conversation=conversation,
                defaults={'role': 'admin' if cm.user_id == request.user.id else 'member'},
            )
        return Response({'status': 'created', 'conversation_id': conversation.id, 'room_id': room.id})


class UserCommunitiesView(generics.ListAPIView):
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Community.objects.filter(
            members=self.request.user
        ).prefetch_related('members', 'memberships')

    def get_serializer_context(self):
        return {'request': self.request}