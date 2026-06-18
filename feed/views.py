from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Post, Reaction, Poll, PollOption, PollVote
from .serializers import PostSerializer, PostCreateSerializer, PollSerializer
from users.models import Follow


class FeedView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        following_ids = Follow.objects.filter(
            follower=self.request.user
        ).values_list('following_id', flat=True)
        return Post.objects.filter(
            author_id__in=following_ids
        ).select_related('author', 'poll').prefetch_related('reactions', 'reposts')


class GlobalFeedView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Post.objects.all().select_related(
            'author', 'poll'
        ).prefetch_related('reactions', 'reposts')


class PostCreateView(generics.CreateAPIView):
    serializer_class = PostCreateSerializer
    permission_classes = [permissions.IsAuthenticated]


class PostDetailView(generics.RetrieveDestroyAPIView):
    queryset = Post.objects.all()
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        return {'request': self.request}

    def destroy(self, request, *args, **kwargs):
        post = self.get_object()
        if post.author != request.user:
            return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        reaction_type = request.data.get('reaction_type')
        if reaction_type not in dict(Reaction.REACTION_TYPES):
            return Response({'error': 'Invalid reaction type.'}, status=status.HTTP_400_BAD_REQUEST)
        reaction, created = Reaction.objects.get_or_create(
            user=request.user, post=post,
            defaults={'reaction_type': reaction_type}
        )
        if not created:
            if reaction.reaction_type == reaction_type:
                reaction.delete()
                return Response({'status': 'removed'})
            else:
                reaction.reaction_type = reaction_type
                reaction.save()
                return Response({'status': 'updated', 'reaction_type': reaction_type})
        return Response({'status': 'reacted', 'reaction_type': reaction_type})


class PollVoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        poll = get_object_or_404(Poll, pk=pk)
        option_id = request.data.get('option_id')
        option = get_object_or_404(PollOption, pk=option_id, poll=poll)
        vote, created = PollVote.objects.get_or_create(
            poll=poll, user=request.user,
            defaults={'option': option}
        )
        if not created:
            return Response({'error': 'Already voted.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'voted', 'option': option.text})


class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        username = self.kwargs['username']
        return Post.objects.filter(
            author__username=username
        ).select_related('author', 'poll').prefetch_related('reactions', 'reposts')