"""
Feed background jobs.

compute_trending (CLAUDE.md 36.6 / Step 5): a periodic Celery Beat task (~every
20 min) that scores recent posts by engagement VELOCITY and caches the global
top-N. Reads are just a cache lookup at request time, so "trending" costs the
same for every viewer (computed once, not per-request).

36.8 fix: reposts weigh heavier than comments, which weigh heavier than
reactions — a repost is active redistribution, not a passive acknowledgment.

Step 7 extends this SAME job to also regex-extract #hashtags from the recent
posts already in memory (no new job, no new schedule).
"""
from celery import shared_task


@shared_task
def compute_trending():
    from datetime import timedelta

    from django.core.cache import cache
    from django.db.models import Count
    from django.utils import timezone

    from .models import Post
    from .scoring import (
        DiscoveryConfig, TRENDING_CACHE_KEY, TRENDING_CACHE_TTL, log_normalize,
    )

    cfg = DiscoveryConfig
    now = timezone.now()
    cutoff = now - timedelta(hours=cfg.TREND_LOOKBACK_HOURS)

    recent = Post.objects.filter(created_at__gte=cutoff).annotate(
        n_react=Count('reactions', distinct=True),
        n_comment=Count('comments', distinct=True),
        n_repost=Count('reposts', distinct=True),
    )

    raw_velocity = {}
    for p in recent:
        weighted = (
            cfg.TREND_W_REACTION * p.n_react
            + cfg.TREND_W_COMMENT * p.n_comment
            + cfg.TREND_W_REPOST * p.n_repost
        )
        if weighted <= 0:
            continue
        age_hours = max(
            (now - p.created_at).total_seconds() / 3600.0,
            cfg.TREND_AGE_FLOOR_HOURS,
        )
        raw_velocity[p.id] = weighted / age_hours

    normalized = log_normalize(raw_velocity)
    top = dict(
        sorted(normalized.items(), key=lambda kv: kv[1], reverse=True)[:cfg.TREND_TOP_N]
    )
    cache.set(TRENDING_CACHE_KEY, top, TRENDING_CACHE_TTL)

    # Step 7 (hashtag trends) hooks in here, reusing `recent` already in memory.
    hashtag_count = _compute_trending_hashtags(recent, now)

    return (
        f"trending: scored {len(raw_velocity)} posts, cached top {len(top)}; "
        f"hashtags cached {hashtag_count}"
    )


def _compute_trending_hashtags(recent_posts, now):
    """Placeholder wired in Step 7 — extracts #hashtags from the same recent-post
    scan. Returns 0 until Step 7 fills it in."""
    return 0
