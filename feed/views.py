from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Post, Reaction, Comment
from .serializers import PostSerializer, PostCreateSerializer, CommentSerializer
from users.models import Follow


# Shared queryset shaping so every feed endpoint fetches the same related rows
# and can't drift (the duplication that caused earlier sync bugs — Section 15).
def _posts_base_qs():
    return Post.objects.select_related('author', 'match').prefetch_related(
        'reactions', 'reposts', 'comments', 'media', 'match__events',
    )


class FeedView(generics.ListAPIView):
    """Following feed (CLAUDE.md 36.3): posts by accounts the viewer follows,
    reverse-chronological. Verified during the Section 38 reconciliation to
    already match the Following spec — kept, not rebuilt."""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        following_ids = Follow.objects.filter(
            follower=self.request.user
        ).values_list('following_id', flat=True)
        return _posts_base_qs().filter(author_id__in=following_ids)


class GlobalFeedView(generics.ListAPIView):
    """For You feed (CLAUDE.md 36.3/36.6). Base endpoint; Step 5 layers the
    affinity/trending/social-proof ranking on top of this same view rather than
    introducing a new endpoint."""
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return _posts_base_qs().all()


class PostCreateView(generics.CreateAPIView):
    serializer_class = PostCreateSerializer
    permission_classes = [permissions.IsAuthenticated]


class PostDetailView(generics.RetrieveDestroyAPIView):
    queryset = _posts_base_qs().all()
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


class UserPostsView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        username = self.kwargs['username']
        return _posts_base_qs().filter(author__username=username)


def _build_comment_tree(comments):
    """Build a nested reply tree from a flat, created_at-ordered comment list in
    application code (CLAUDE.md 36.7 — no recursive SQL). Each node gets a
    'replies' list; only top-level comments (parent is None) are returned as
    roots. Orphans (parent filtered out) fall back to root level."""
    nodes = {c['id']: {**c, 'replies': []} for c in comments}
    roots = []
    for c in comments:
        node = nodes[c['id']]
        parent_id = c.get('parent')
        if parent_id and parent_id in nodes:
            nodes[parent_id]['replies'].append(node)
        else:
            roots.append(node)
    return roots


class PostCommentsView(APIView):
    """GET → the full comment thread for a post as a nested tree (one flat
    query, nested in Python). POST → add a comment; optional `parent` in the
    body makes it a reply."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        comments = post.comments.select_related('author').all()  # Meta orders by created_at
        flat = CommentSerializer(comments, many=True, context={'request': request}).data
        return Response(_build_comment_tree(flat))

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        content = (request.data.get('content') or '').strip()
        if not content:
            return Response({'error': 'content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        parent = None
        parent_id = request.data.get('parent')
        if parent_id:
            # A reply's parent must belong to the same post.
            parent = get_object_or_404(Comment, pk=parent_id, post=post)

        comment = Comment.objects.create(
            post=post, author=request.user, parent=parent, content=content,
        )
        data = CommentSerializer(comment, context={'request': request}).data
        return Response(data, status=status.HTTP_201_CREATED)


class CommentDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        if comment.author != request.user:
            return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
