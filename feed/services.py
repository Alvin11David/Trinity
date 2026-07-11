"""
Feed domain services.

match_object recap posts (CLAUDE.md 36.2, Step 2): a single post-match recap
Post is created ONCE at full-time by a global system account, riding the
existing finish-detection hook (check_for_finished_matches, Section 30). Nothing
about the recap updates after creation. The final score and goal-scorer names
are NOT stored on the Post — they're derived at render time from the linked
Match and its MatchEvent rows (both already populated by the finish hook before
the recap is created).
"""

# A single global system account authors every auto-generated recap
# (36.2: "a single global system account, not per-league"). Username chosen to
# read as the product's own voice in-feed.
SYSTEM_USERNAME = 'ball'


def get_system_user():
    """Return (creating if needed) the global system account used as the author
    of auto-generated match_object recap posts. Idempotent."""
    from users.models import User
    user, _ = User.objects.get_or_create(
        username=SYSTEM_USERNAME,
        defaults={
            'first_name': 'Ball',
            'bio': 'Automated full-time match recaps.',
            'is_active': True,
        },
    )
    return user


def create_match_recap_post(match_id):
    """
    Create the single post-match recap Post for a finished match. Idempotent:
    keyed on (system author, match, match_object), so re-running the finish hook
    never produces duplicates, and a user manually sharing the same match
    (author = that user) never collides with the system recap.

    Returns the created Post, or None if nothing was created (match missing,
    not finished, or recap already exists).
    """
    from matches.models import Match
    from .models import Post

    match = Match.objects.filter(id=match_id).first()
    if not match or match.status != 'finished':
        return None

    system_user = get_system_user()
    post, created = Post.objects.get_or_create(
        author=system_user,
        post_type='match_object',
        match=match,
        defaults={'content': ''},  # content derived at render time, not stored
    )
    return post if created else None


def recompute_post_media_state(post):
    """Aggregate a Post's media readiness (CLAUDE.md 36.9): 'processing' while
    any attached media is not yet 'ready' (a Mux video mid-transcode), else
    'ready'. Called after a photo is finalized or a Mux webhook fires."""
    from .models import Post

    has_pending = post.media.exclude(status='ready').exists()
    new_state = 'processing' if has_pending else 'ready'
    if post.media_state != new_state:
        post.media_state = new_state
        post.save(update_fields=['media_state', 'updated_at'])
    return new_state

