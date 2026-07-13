"""
Shared validation for typed chat messages, used by BOTH the REST serializer
(MessageSerializer.validate) and the WebSocket consumer (ChatConsumer.save_message)
so the two paths can never drift apart.

Returns an error string when the payload is invalid, or None when it's fine.
The REST path turns a non-None result into a ValidationError; the WS path sends
it back as an error frame and refuses to persist.
"""

# Match rooms are a deliberately more restricted surface than regular
# groups/channels: only plain text (user-sent) and goal_event (system-sent)
# belong there. No polls, no shared cards. Enforced on both REST + WS so
# frontend hiding is never the only guard.
MATCH_ROOM_ALLOWED_TYPES = ('text', 'goal_event')


def is_match_room(conversation):
    """True if this Conversation is a match's live room (matches.MatchRoom)."""
    if conversation is None:
        return False
    return hasattr(conversation, 'match_room')


def validate_message_payload(message_type, match_id=None, metadata=None, conversation=None):
    # Conversation-level surface restriction first: in a match room, reject
    # anything other than text/goal_event before checking type-specific rules.
    if is_match_room(conversation) and message_type not in MATCH_ROOM_ALLOWED_TYPES:
        return 'Only text messages can be sent in match rooms.'

    if message_type == 'match_card':
        if not match_id:
            return 'match_id is required for match_card messages.'
        from matches.models import validate_match_id
        if not validate_match_id(match_id):
            return 'Invalid match_id — no matching Match found.'

    elif message_type == 'prediction_card':
        if not match_id:
            return 'match_id is required for prediction_card messages.'
        from matches.models import Match
        match = Match.objects.filter(id=match_id).first()
        if not match:
            return 'Invalid match_id — no matching Match found.'
        # A prediction card is meaningless without a prediction to render.
        if not match.winnie_prediction:
            return 'This match has no Winnie prediction to share.'

    elif message_type == 'poll':
        options = metadata.get('options') if isinstance(metadata, dict) else None
        valid_options = [o for o in options if isinstance(o, str) and o.strip()] if isinstance(options, list) else []
        if len(valid_options) < 2:
            return 'A poll requires metadata.options with at least 2 non-empty options.'

    return None
