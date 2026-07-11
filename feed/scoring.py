"""
Feed discovery scoring (CLAUDE.md 36.6 / Step 5) and the trending job's weights.

The For You feed merges three candidate pools (affinity / trending / social
proof) and ranks them with one weighted formula:

    score = recency_decay(created_at) * (w1*affinity + w2*trending + w3*social_proof)

ALL tunable constants live in `DiscoveryConfig` below — a single named config
location so weights can be retuned without touching scoring logic (36.6: "kept
as a single named config value ... adjustable later without touching code").

36.8 fixes applied here:
  * Trending velocity weights reposts HEAVIER than reactions/comments (a repost
    is active distribution, not passive acknowledgment).
  * Social proof counts reposts (Post.repost_of) as a third engagement source
    alongside reactions and comments — not just likes/comments.
"""
import math

from django.core.cache import cache


class DiscoveryConfig:
    # ---- Merge weights (w1/w2/w3) — placeholders, no live data to tune yet ----
    W_AFFINITY = 1.0
    W_TRENDING = 1.0
    W_SOCIAL_PROOF = 1.0

    # ---- Affinity (graded, not binary) ----
    AFFINITY_TEAM = 1.0        # post about a team the viewer follows
    AFFINITY_LEAGUE = 0.6      # post about a followed league (team not followed)

    # ---- Recency decay (exponential half-life; football content ages fast) ----
    RECENCY_HALF_LIFE_HOURS = 18.0

    # ---- Social proof: min(engaging_follows / CAP, 1.0) ----
    SOCIAL_PROOF_CAP = 3.0

    # ---- Trending job (engagement velocity) ----
    # 36.8: reposts weigh more than comments, which weigh more than reactions.
    TREND_W_REACTION = 1.0
    TREND_W_COMMENT = 1.5
    TREND_W_REPOST = 3.0
    TREND_LOOKBACK_HOURS = 48        # only recent posts are trending candidates
    TREND_AGE_FLOOR_HOURS = 2.0      # avoid divide-by-tiny for brand-new posts
    TREND_TOP_N = 200                # how many top posts to cache

    # ---- Request-time candidate pool sizes ----
    AFFINITY_POOL_LOOKBACK_HOURS = 48
    AFFINITY_POOL_LIMIT = 200
    SOCIAL_POOL_LOOKBACK_HOURS = 48
    FEED_PAGE_LIMIT = 100            # max scored posts returned by For You


# Cache keys populated by feed.tasks.compute_trending (Step 5) and read at
# request time. The hashtags key is filled by the same job (Step 7).
TRENDING_CACHE_KEY = 'feed:trending_scores'        # {post_id: normalized_score}
TRENDING_HASHTAGS_KEY = 'feed:trending_hashtags'   # [{'tag','count','score'}...]
TRENDING_CACHE_TTL = 60 * 45                       # 45 min (job runs ~every 20)


def recency_decay(created_at, now):
    """Exponential half-life decay in [0, 1]."""
    age_hours = max((now - created_at).total_seconds() / 3600.0, 0.0)
    return 0.5 ** (age_hours / DiscoveryConfig.RECENCY_HALF_LIFE_HOURS)


def get_followed_league_ids(user):
    """League IDs the viewer follows (leagues.UserLeagueFollow)."""
    from leagues.models import UserLeagueFollow
    return set(
        UserLeagueFollow.objects.filter(user=user)
        .values_list('league__league_id', flat=True)
    )


def get_followed_team_ids(user):
    """Team IDs the viewer follows.

    Populated by leagues.UserTeamFollow, which is built in Step 8 (the
    team-follow relationship confirmed ABSENT in the Step 0 audit). Until then
    this returns an empty set, so the affinity TEAM tier (1.0) is simply inert
    and league affinity (0.6) carries the pool — no crash, no stub model. Step 8
    swaps the body to query UserTeamFollow and team affinity activates.
    """
    try:
        from leagues.models import UserTeamFollow
    except ImportError:
        return set()
    return set(
        UserTeamFollow.objects.filter(user=user).values_list('team_id', flat=True)
    )


def affinity_score(post, followed_league_ids, followed_team_ids):
    """Graded affinity: 1.0 if the post's match involves a followed team, 0.6 if
    it's in a followed league, else 0. Only match_object posts carry an
    intrinsic league/team signal; plain/winnie posts score 0 here (they can
    still surface via trending / social proof)."""
    match = post.match
    if not match:
        return 0.0
    if followed_team_ids and (
        match.home_team_id in followed_team_ids
        or match.away_team_id in followed_team_ids
    ):
        return DiscoveryConfig.AFFINITY_TEAM
    if match.league_id in followed_league_ids:
        return DiscoveryConfig.AFFINITY_LEAGUE
    return 0.0


def social_proof_score(engaging_follow_count):
    """Normalize the count of distinct followed accounts that engaged with a
    post to [0, 1], capped so a few strong signals don't dominate."""
    if not engaging_follow_count:
        return 0.0
    return min(engaging_follow_count / DiscoveryConfig.SOCIAL_PROOF_CAP, 1.0)


def get_trending_scores():
    """Read the cached {post_id: normalized_trending_score} map (empty if the
    job hasn't run or the cache is cold — For You degrades gracefully)."""
    return cache.get(TRENDING_CACHE_KEY) or {}


def log_normalize(values):
    """log1p-normalize a {key: raw_velocity} map into [0, 1] (36.6: 'so viral
    posts don't drown everything else')."""
    if not values:
        return {}
    logged = {k: math.log1p(max(v, 0.0)) for k, v in values.items()}
    peak = max(logged.values()) or 1.0
    return {k: v / peak for k, v in logged.items()}
