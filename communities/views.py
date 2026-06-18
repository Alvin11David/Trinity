from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Community, CommunityMembership, CommunityPost, CommunityPostVote
from .serializers import (
    CommunitySerializer, CommunityPostSerializer, CommunityPostCreateSerializer
)


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
            return Response({'status': 'left'})
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


class UserCommunitiesView(generics.ListAPIView):
    serializer_class = CommunitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Community.objects.filter(
            members=self.request.user
        ).prefetch_related('members', 'memberships')

    def get_serializer_context(self):
        return {'request': self.request}