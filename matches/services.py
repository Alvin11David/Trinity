"""
Matches domain services.

MatchRoom auto-creation: a MatchRoom (Match ↔ chat.Conversation) is reliably
created at the scheduled → live transition — mirroring how the Feed recap post
is created at the live → finished transition. Idempotent (OneToOne on both
sides + get-or-create semantics), so it's safe to call defensively from the
live-event pipeline too if a room is somehow missing.
"""


def ensure_match_room(match):
    """Return the MatchRoom for this match, creating it (and its backing
    Conversation) if it doesn't exist yet. Idempotent."""
    from .models import MatchRoom
    from chat.models import Conversation

    existing = MatchRoom.objects.filter(match=match).select_related('conversation').first()
    if existing:
        return existing

    conversation = Conversation.objects.create(
        conversation_type='channel',
        channel_mode='open',  # anyone in the room can chat during the match
        name=f"{match.home_team.name if match.home_team_id else '?'} vs {match.away_team.name if match.away_team_id else '?'}",
        is_public=True,
        created_by=None,  # system-created, no human owner
    )
    return MatchRoom.objects.create(match=match, conversation=conversation)
