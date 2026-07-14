"""Shared block logic (Step 2).

A block is bidirectional in effect: if A blocked B, then for every surface
(DMs, Follow, Search, Feed, profile visibility) NEITHER can see or interact with
the other. Rather than duplicate the "check both directions" logic across the
three separate Feed/Search query paths (which is where it would otherwise get
messy), everything funnels through these two helpers.
"""
from django.db.models import Q


def blocked_user_ids(user):
    """Every user id the given user is cut off from in EITHER direction — i.e.
    people they've blocked plus people who've blocked them. Returned as a set so
    callers can pass it straight to `author_id__in` exclusions or `.exclude()`."""
    if not user or not user.is_authenticated:
        return set()
    from .models import Block
    outgoing = Block.objects.filter(blocker=user).values_list('blocked_id', flat=True)
    incoming = Block.objects.filter(blocked=user).values_list('blocker_id', flat=True)
    return set(outgoing) | set(incoming)


def is_blocked_between(a, b):
    """True if a block exists in either direction between two users."""
    if not a or not b:
        return False
    from .models import Block
    return Block.objects.filter(
        Q(blocker=a, blocked=b) | Q(blocker=b, blocked=a)
    ).exists()


def exclude_blocked_authors(qs, user, author_field='author_id'):
    """Drop rows authored by anyone blocked in either direction. The single place
    Following, For You, and Search all call so the exclusion can't drift between
    them (Step 2's cross-cutting Feed requirement)."""
    ids = blocked_user_ids(user)
    if ids:
        return qs.exclude(**{f'{author_field}__in': ids})
    return qs
