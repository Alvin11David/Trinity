from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from .models import Post, Reaction, Comment, PostMedia
from .serializers import (
    PostSerializer, PostCreateSerializer, CommentSerializer, PostMediaSerializer,
)
from . import media as media_lib
from .services import recompute_post_media_state
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


# --------------------------------------------------------------------------- #
# Media pipeline (CLAUDE.md 36.9 / Step 4)
# --------------------------------------------------------------------------- #

class MediaUploadURLView(APIView):
    """Issue a direct-upload credential for a piece of media on the caller's own
    post. Video → Mux direct upload (post goes 'processing' until the webhook).
    Photo → S3 presigned PUT (finalized separately). The phone uploads the raw
    bytes directly to the returned URL — never through Django."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        post = get_object_or_404(Post, pk=request.data.get('post_id'))
        if post.author != request.user:
            return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)

        media_type = request.data.get('media_type')
        if media_type not in ('video', 'photo'):
            return Response({'error': "media_type must be 'video' or 'photo'."},
                            status=status.HTTP_400_BAD_REQUEST)

        order = request.data.get('order', 0)

        try:
            if media_type == 'video':
                cred = media_lib.create_mux_direct_upload()
                media = PostMedia.objects.create(
                    post=post, media_type='video', status='processing',
                    order=order, mux_upload_id=cred['upload_id'],
                )
                recompute_post_media_state(post)  # → processing
                return Response({
                    'media_id': media.id,
                    'provider': 'mux',
                    'upload_url': cred['upload_url'],
                    'upload_id': cred['upload_id'],
                }, status=status.HTTP_201_CREATED)

            # photo
            content_type = request.data.get('content_type', 'image/jpeg')
            cred = media_lib.create_s3_presigned_upload(content_type=content_type)
            media = PostMedia.objects.create(
                post=post, media_type='photo', status='processing',
                order=order, storage_key=cred['storage_key'],
            )
            recompute_post_media_state(post)
            return Response({
                'media_id': media.id,
                'provider': 's3',
                'upload_url': cred['upload_url'],
                'storage_key': cred['storage_key'],
                'public_url': cred['public_url'],
                'content_type': content_type,
            }, status=status.HTTP_201_CREATED)

        except media_lib.MediaConfigError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class PhotoFinalizeView(APIView):
    """Called by the phone after its direct S3 PUT succeeds. Reads the object
    back, validates + measures it with Pillow, marks it ready, and recomputes
    the post's aggregate media state."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        media = get_object_or_404(PostMedia, pk=pk, media_type='photo')
        if media.post.author != request.user:
            return Response({'error': 'Not allowed.'}, status=status.HTTP_403_FORBIDDEN)
        try:
            media_lib.finalize_photo(media)
        except media_lib.MediaConfigError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as exc:
            return Response({'error': f'Could not finalize photo: {exc}'},
                            status=status.HTTP_400_BAD_REQUEST)
        recompute_post_media_state(media.post)
        return Response(PostMediaSerializer(media).data)


class MuxWebhookView(APIView):
    """Mux webhook receiver. On `video.asset.ready` the PostMedia (matched by
    upload id) is populated with playback/thumbnail/duration and flipped ready,
    then the post's media state is recomputed. Unauthenticated (Mux → us);
    integrity is enforced by the Mux-Signature HMAC instead."""
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not media_lib.verify_mux_signature(request.body, request.headers.get('Mux-Signature', '')):
            return Response({'error': 'Invalid signature.'}, status=status.HTTP_401_UNAUTHORIZED)

        event = request.data or {}
        if event.get('type') != 'video.asset.ready':
            # We only act on ready; ack everything else so Mux stops retrying.
            return Response({'status': 'ignored'})

        data = event.get('data', {})
        upload_id = data.get('upload_id')
        asset_id = data.get('id')
        media = None
        if upload_id:
            media = PostMedia.objects.filter(mux_upload_id=upload_id).first()
        if media is None and asset_id:
            media = PostMedia.objects.filter(mux_asset_id=asset_id).first()
        if media is None:
            return Response({'status': 'no matching media'})

        playback_ids = data.get('playback_ids') or []
        playback_id = playback_ids[0]['id'] if playback_ids else None
        duration = data.get('duration')

        from django.conf import settings
        if duration and duration > settings.MUX_MAX_VIDEO_DURATION:
            # Over the per-upload cap (36.10) — reject rather than publish.
            media.status = 'failed'
            media.mux_asset_id = asset_id
            media.duration = duration
            media.save(update_fields=['status', 'mux_asset_id', 'duration', 'updated_at'])
        else:
            media.mux_asset_id = asset_id
            media.mux_playback_id = playback_id
            media.duration = duration
            media.thumbnail_url = media_lib.mux_thumbnail_url(playback_id) if playback_id else None
            media.status = 'ready'
            media.save()

        recompute_post_media_state(media.post)
        return Response({'status': 'ok'})
