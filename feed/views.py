from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import CursorPagination, LimitOffsetPagination
from django.shortcuts import get_object_or_404
from .models import Post, Reaction, Comment, PostMedia
from .serializers import (
    PostSerializer, PostCreateSerializer, CommentSerializer, PostMediaSerializer,
)
from . import media as media_lib
from .services import recompute_post_media_state
from users.models import Follow
from users.blocking import exclude_blocked_authors, is_blocked_between


# Shared queryset shaping so every feed endpoint fetches the same related rows
# and can't drift (the duplication that caused earlier sync bugs — Section 15).
def _posts_base_qs():
    return Post.objects.select_related('author', 'match').prefetch_related(
        'reactions', 'reposts', 'comments', 'media', 'match__events',
    )


class FollowingCursorPagination(CursorPagination):
    """Stable keyset pagination for the reverse-chron Following feed. Ordered by
    (created_at, id) so the id tie-breaks posts sharing a timestamp — no drift or
    duplicates as new posts arrive at the head."""
    page_size = 20
    ordering = ('-created_at', '-id')
    cursor_query_param = 'cursor'


class FeedLimitOffsetPagination(LimitOffsetPagination):
    """offset/limit for the For You feed. The ranked list is recomputed per
    request (no cached snapshot) — minor rank drift between pages is an accepted
    trade-off (Section 43), not a bug."""
    default_limit = 20
    max_limit = 50


class FeedView(generics.ListAPIView):
    """Following feed (CLAUDE.md 36.3), reverse-chronological.

    Following = (posts from accounts the viewer follows)
              ∪ (match_object recap posts by the system account, filtered
                 through the viewer's UserLeagueFollow list).

    The second branch is the 36.2 distribution mechanism for system recap posts,
    formally confirmed 2026-07-11 (Section 38.7): recaps are authored by the
    global system account, which nobody follows, so without this they'd never
    reach Following — they surface for viewers who follow the recap's league.
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = FollowingCursorPagination

    def get_queryset(self):
        from django.db.models import Q
        from leagues.models import UserLeagueFollow
        from .services import SYSTEM_USERNAME

        user = self.request.user
        following_ids = Follow.objects.filter(
            follower=user
        ).values_list('following_id', flat=True)
        followed_league_ids = UserLeagueFollow.objects.filter(
            user=user
        ).values_list('league__league_id', flat=True)

        # OR-filter (deduped, keeps the base -created_at ordering). If the viewer
        # follows no leagues, the recap branch matches nothing → just followed
        # users, exactly as before.
        qs = _posts_base_qs().filter(
            Q(author_id__in=following_ids)
            | Q(
                author__username=SYSTEM_USERNAME,
                post_type='match_object',
                match__league_id__in=followed_league_ids,
            )
        )
        # Step 2: hide posts by anyone blocked in either direction. Same shared
        # helper used by For You and Search so the exclusion can't drift.
        return exclude_blocked_authors(qs, user)


class GlobalFeedView(generics.ListAPIView):
    """For You feed (CLAUDE.md 36.3 / 36.6 / Step 5).

    Merges three narrow candidate pools and ranks them with the single weighted
    formula from feed.scoring — NOT one score-vs-every-post pass:
      * affinity      — recent match_object posts in followed leagues/teams
      * trending      — cached global top-N (computed once by compute_trending)
      * social proof  — posts recently engaged by accounts the viewer follows,
                        bounded by the follow-list (reactions + comments +
                        reposts, per the 36.8 fix)

    Cold start falls out for free: a zero-follow viewer has empty affinity and
    social-proof pools, so For You is just the trending pool.
    """
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        from django.utils import timezone
        from . import scoring

        user = request.user
        cache_key = scoring.FORYOU_FROZEN_KEY.format(user_id=user.id)

        try:
            offset = int(request.query_params.get('offset', 0) or 0)
        except (TypeError, ValueError):
            offset = 0

        # offset==0 means the first page OR a pull-to-refresh — both re-freeze
        # the ranked list. offset>0 slices the frozen list; a missing/expired
        # (TTL) frozen list is regenerated on demand.
        frozen = None if offset == 0 else cache.get(cache_key)
        if frozen is None:
            frozen = self._build_ranked_ids(user, timezone.now())
            cache.set(cache_key, frozen, scoring.FORYOU_FROZEN_TTL)

        # Slice the FROZEN ordered id list, then hydrate + serialize the page's
        # posts in that frozen order — no per-page rescoring, so scores shifting
        # between requests can't duplicate or skip posts mid-scroll.
        paginator = FeedLimitOffsetPagination()
        page_ids = paginator.paginate_queryset(frozen, request, view=self) or []
        by_id = {p.id: p for p in _posts_base_qs().filter(id__in=page_ids)}
        page_posts = [by_id[pid] for pid in page_ids if pid in by_id]
        serializer = self.get_serializer(page_posts, many=True)
        return paginator.get_paginated_response(serializer.data)

    def _build_ranked_ids(self, user, now):
        """Compute the merged 3-pool candidate set (affinity + trending + social
        proof), rank it once with the shared ranker, and return the ordered list
        of post ids (CLAUDE.md 36.6). Runs only on first load / refresh / TTL
        expiry — subsequent pages slice the cached result (43.4)."""
        from datetime import timedelta
        from django.db.models import Q
        from . import scoring
        from .models import Reaction, Comment

        cfg = scoring.DiscoveryConfig
        followed_leagues = scoring.get_followed_league_ids(user)
        followed_teams = scoring.get_followed_team_ids(user)
        follow_ids = list(
            Follow.objects.filter(follower=user).values_list('following_id', flat=True)
        )
        trending = scoring.get_trending_scores()

        candidate_ids = set()

        # Pool 1 — affinity
        if followed_leagues or followed_teams:
            aff_cutoff = now - timedelta(hours=cfg.AFFINITY_POOL_LOOKBACK_HOURS)
            cond = Q(match__league_id__in=followed_leagues)
            if followed_teams:
                cond |= (
                    Q(match__home_team_id__in=followed_teams)
                    | Q(match__away_team_id__in=followed_teams)
                )
            candidate_ids.update(
                Post.objects.filter(created_at__gte=aff_cutoff, post_type='match_object')
                .filter(cond)
                .values_list('id', flat=True)[:cfg.AFFINITY_POOL_LIMIT]
            )

        # Pool 2 — trending (cache read; keys are post ids)
        candidate_ids.update(trending.keys())

        # Pool 3 — social proof (reactions + comments + reposts by follows; 36.8)
        if follow_ids:
            sp_cutoff = now - timedelta(hours=cfg.SOCIAL_POOL_LOOKBACK_HOURS)
            candidate_ids.update(
                Reaction.objects.filter(user_id__in=follow_ids, created_at__gte=sp_cutoff)
                .values_list('post_id', flat=True)
            )
            candidate_ids.update(
                Comment.objects.filter(author_id__in=follow_ids, created_at__gte=sp_cutoff)
                .values_list('post_id', flat=True)
            )
            candidate_ids.update(
                Post.objects.filter(
                    author_id__in=follow_ids, repost_of__isnull=False,
                    created_at__gte=sp_cutoff,
                ).values_list('repost_of_id', flat=True)
            )

        # Step 2: the block exclusion covers all three candidate pools at once
        # (affinity, trending, social-proof) because they're merged into this one
        # queryset before ranking — no need to filter each pool separately.
        posts = _posts_base_qs().filter(id__in=candidate_ids).exclude(author=user)
        posts = exclude_blocked_authors(posts, user)
        return [p.id for p in scoring.rank_posts(posts, user, now=now)]


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


# --------------------------------------------------------------------------- #
# Search (CLAUDE.md 37.2 / 37.3 / Step 6)
# --------------------------------------------------------------------------- #

class SearchView(APIView):
    """Postgres full-text search (tsvector/tsquery) + pg_trgm — no external
    search engine. Five tabs over sources that already exist:

      Top     — text-matched posts ranked with the SAME 36.6 formula (reuses
                scoring.rank_posts, just over a text-matched pool)
      Latest  — same post pool, reverse-chronological
      People  — User FTS (+ trigram for partial handles)
      Matches — Match text search on team/league names (trigram), as cards
      Media   — text-matched posts filtered to those with attachments (36.9)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        tab = (request.query_params.get('tab') or 'top').lower()
        try:
            limit = min(int(request.query_params.get('limit', 50)), 100)
        except (TypeError, ValueError):
            limit = 50

        if not q:
            return Response({'tab': tab, 'query': q, 'results': []})

        handler = {
            'people': self._people,
            'matches': self._matches,
            'latest': self._latest,
            'media': self._media,
            'top': self._top,
        }.get(tab, self._top)
        return Response({'tab': tab, 'query': q, 'results': handler(q, request, limit)})

    def _post_text_matches(self, q):
        from django.contrib.postgres.search import SearchQuery, SearchVector
        query = SearchQuery(q, search_type='websearch', config='english')
        qs = _posts_base_qs().annotate(
            doc=SearchVector('content', config='english')
        ).filter(doc=query)
        # Step 2: exclude posts by blocked users from every post-based tab
        # (Top/Latest/Media all funnel through here).
        return exclude_blocked_authors(qs, self.request.user)

    def _top(self, q, request, limit):
        from . import scoring
        posts = list(self._post_text_matches(q)[:scoring.DiscoveryConfig.AFFINITY_POOL_LIMIT])
        ranked = scoring.rank_posts(posts, request.user)[:limit]
        return PostSerializer(ranked, many=True, context={'request': request}).data

    def _latest(self, q, request, limit):
        posts = self._post_text_matches(q).order_by('-created_at')[:limit]
        return PostSerializer(posts, many=True, context={'request': request}).data

    def _media(self, q, request, limit):
        posts = (
            self._post_text_matches(q)
            .filter(media__isnull=False).distinct().order_by('-created_at')[:limit]
        )
        return PostSerializer(posts, many=True, context={'request': request}).data

    def _people(self, q, request, limit):
        from django.contrib.postgres.search import (
            SearchQuery, SearchVector, TrigramSimilarity,
        )
        from django.db.models import Q
        from users.models import User
        from users.serializers import UserSerializer

        from users.blocking import blocked_user_ids

        query = SearchQuery(q, search_type='websearch', config='english')
        users = (
            User.objects.annotate(
                doc=SearchVector('username', 'first_name', 'last_name', 'bio', config='english'),
                sim=TrigramSimilarity('username', q),
            )
            .filter(Q(doc=query) | Q(username__icontains=q))
            # Step 2: People search hides blocked users in BOTH directions.
            .exclude(id__in=blocked_user_ids(request.user))
            .order_by('-sim')[:limit]
        )
        return UserSerializer(users, many=True, context={'request': request}).data

    def _matches(self, q, request, limit):
        from django.contrib.postgres.search import TrigramSimilarity
        from django.db.models import Q
        from matches.models import Match
        from matches.serializers import MatchCardSerializer

        matches = (
            Match.objects.annotate(
                sim=TrigramSimilarity('home_team', q)
                + TrigramSimilarity('away_team', q)
                + TrigramSimilarity('league_name', q)
            )
            .filter(
                Q(home_team__icontains=q)
                | Q(away_team__icontains=q)
                | Q(league_name__icontains=q)
            )
            .order_by('-sim', 'kickoff_time')[:limit]
        )
        return MatchCardSerializer(matches, many=True).data


# --------------------------------------------------------------------------- #
# Autocomplete / typeahead (CLAUDE.md 37.5 / Step 9)
# --------------------------------------------------------------------------- #

class AutocompleteView(APIView):
    """Deliberately CHEAP and separate from SearchView — this fires on every
    keystroke, so it must NOT run the ranked search pipeline (37.5). It does a
    pg_trgm username prefix match plus a prefix filter over the cached trending
    hashtag list (Step 7). Empty query returns the top trending hashtags, which
    also feeds the Trends surface (37.4: zero new endpoints beyond typeahead)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.core.cache import cache
        from .scoring import TRENDING_HASHTAGS_KEY

        q = (request.query_params.get('q') or '').strip()
        try:
            limit = min(int(request.query_params.get('limit', 8)), 20)
        except (TypeError, ValueError):
            limit = 8

        all_tags = cache.get(TRENDING_HASHTAGS_KEY) or []

        # Empty prefix → top trending hashtags (Trends surface / initial state).
        if not q:
            return Response({'query': q, 'users': [], 'hashtags': all_tags[:limit]})

        prefix = q.lstrip('#').lower()
        hashtags = [t for t in all_tags if t['tag'].startswith(prefix)][:limit]

        users = []
        if not q.startswith('#'):
            from django.contrib.postgres.search import TrigramSimilarity
            from users.models import User
            user_qs = (
                User.objects.filter(username__istartswith=q)
                .annotate(sim=TrigramSimilarity('username', q))
                .order_by('-sim')[:limit]
            )
            users = [
                {'id': u.id, 'username': u.username, 'avatar': u.avatar}
                for u in user_qs
            ]

        return Response({'query': q, 'users': users, 'hashtags': hashtags})
