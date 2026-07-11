"""
Notification fan-out (CLAUDE.md 36.4 / Step 8).

These run as SEPARATE async Celery tasks (not inline in the live poller) so one
popular match's fan-out can't block the poller from moving to the next live
match. Each match event / full-time fans out to followers of EITHER team
(leagues.UserTeamFollow) via BOTH channels from the start:
  * in-app  → a Notification row per recipient (served by the existing
              NotificationListView / unread endpoints)
  * push    → Expo push to each recipient's registered device(s)

Granularity is "everything" (goals/cards/subs/FT) per 36.4 — no muting in v1.
"""
from celery import shared_task


# MatchEvent.event_type → Notification.notification_type
_EVENT_TO_NOTIF_TYPE = {
    'goal': 'goal',
    'yellow_card': 'card',
    'red_card': 'card',
    'substitution': 'substitution',
    'var': 'goal',   # VAR usually concerns a goal/penalty; surface it as goal
}


def _score_str(match):
    hs = match.home_score if match.home_score is not None else 0
    aus = match.away_score if match.away_score is not None else 0
    return f"{match.home_team} {hs}-{aus} {match.away_team}"


def _format_event(event, match):
    """Human title/body for a live event notification."""
    minute = f"{event.minute}'" if event.minute is not None else ''
    if event.event_type == 'goal':
        title = f"⚽ GOAL — {event.team}"
        scorer = event.player or 'Goal'
        assist = f" (assist: {event.assist_player})" if event.assist_player else ''
        body = f"{scorer} {minute}{assist} · {_score_str(match)}"
    elif event.event_type in ('yellow_card', 'red_card'):
        card = 'Red card' if event.event_type == 'red_card' else 'Yellow card'
        title = f"🟨 {card} — {event.team}" if event.event_type == 'yellow_card' else f"🟥 {card} — {event.team}"
        body = f"{event.player} {minute} · {_score_str(match)}"
    elif event.event_type == 'substitution':
        title = f"🔁 Substitution — {event.team}"
        off = event.player or ''
        on = f" ↔ {event.assist_player}" if event.assist_player else ''
        body = f"{off}{on} {minute} · {_score_str(match)}"
    else:
        title = f"{event.team} — update"
        body = f"{event.detail or event.event_type} {minute} · {_score_str(match)}"
    return title, body


def _team_follower_ids(match):
    from leagues.models import UserTeamFollow

    team_ids = [t for t in (match.home_team_id, match.away_team_id) if t]
    if not team_ids:
        return []
    return list(
        UserTeamFollow.objects.filter(team_id__in=team_ids)
        .values_list('user_id', flat=True).distinct()
    )


def _deliver(recipient_ids, notif_type, title, body, match_id):
    """Create in-app Notification rows + send Expo push."""
    from .models import Notification
    from .push import send_expo_push

    if not recipient_ids:
        return 0
    Notification.objects.bulk_create([
        Notification(
            recipient_id=uid, notification_type=notif_type,
            title=title[:100], body=body[:280], match_id=match_id,
        )
        for uid in recipient_ids
    ])
    send_expo_push(recipient_ids, title, body, data={'match_id': match_id, 'type': notif_type})
    return len(recipient_ids)


@shared_task
def fan_out_match_event_notification(event_id):
    """Fan out a single live MatchEvent (goal/card/sub) to both teams' followers."""
    from matches.models import MatchEvent

    event = MatchEvent.objects.select_related('match').filter(id=event_id).first()
    if not event:
        return "event not found"
    match = event.match
    notif_type = _EVENT_TO_NOTIF_TYPE.get(event.event_type, 'goal')
    title, body = _format_event(event, match)
    n = _deliver(_team_follower_ids(match), notif_type, title, body, match.id)
    return f"fanned out event {event_id} to {n} followers"


@shared_task
def fan_out_match_final_notification(match_id):
    """Fan out full-time (FT) to both teams' followers (36.4 granularity)."""
    from matches.models import Match

    match = Match.objects.filter(id=match_id).first()
    if not match:
        return "match not found"
    title = f"⏱ Full time — {match.home_team} vs {match.away_team}"
    body = f"FT · {_score_str(match)}"
    n = _deliver(_team_follower_ids(match), 'match_result', title, body, match.id)
    return f"fanned out FT for match {match_id} to {n} followers"
