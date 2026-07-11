from celery import shared_task
from django.utils import timezone
from datetime import timedelta


@shared_task
def check_for_finished_matches():
    """
    Runs frequently (every 2-3 min). Checks matches that should have started
    by now but aren't marked finished yet, re-fetches their live status from
    API-Football, and triggers per-league resyncs for any that just completed.
    """
    from .models import Match
    from matches.api_football_client import api_football_client

    STATUS_MAP = {
        'NS': 'scheduled', 'TBD': 'scheduled',
        '1H': 'live', 'HT': 'live', '2H': 'live', 'ET': 'live', 'P': 'live', 'BT': 'live',
        'FT': 'finished', 'AET': 'finished', 'PEN': 'finished',
        'PST': 'postponed', 'CANC': 'postponed', 'ABD': 'postponed', 'SUSP': 'postponed', 'INT': 'postponed',
    }

    # Candidates: kicked off already, not yet marked finished/postponed
    cutoff = timezone.now() - timedelta(hours=3)  # matches don't run longer than ~3hrs including delays
    candidates = Match.objects.filter(
        kickoff_time__lte=timezone.now(),
        kickoff_time__gte=cutoff,
        status__in=['scheduled', 'live'],
    )

    newly_finished_league_ids = set()
    newly_finished_match_ids = []

    for match in candidates:
        data = api_football_client._get('fixtures', params={'id': match.api_football_id})
        if not data:
            continue
        fixture_data = data[0]
        status_short = fixture_data['fixture']['status']['short']
        new_status = STATUS_MAP.get(status_short, match.status)

        was_finished = match.status == 'finished'
        match.status = new_status
        match.status_short = status_short
        match.minute = fixture_data['fixture']['status'].get('elapsed')
        match.home_score = fixture_data['goals'].get('home')
        match.away_score = fixture_data['goals'].get('away')
        match.save()

        if new_status == 'finished' and not was_finished:
            newly_finished_match_ids.append(match.id)
            if match.league_id:
                newly_finished_league_ids.add((match.league_id, match.season))

    for league_id, season in newly_finished_league_ids:
        if league_id and season:
            resync_league_after_match.delay(league_id, season)

    # Per-match player stats, team statistics, events, and lineups are
    # synced synchronously here (not via .delay()) since it's one cheap call
    # each per newly-finished match, not per-league. Lineup was previously
    # missing from this list — it's posted before/at kickoff, so a finished
    # match should always have it available; it just needs one call, same as
    # the others (unlike odds, which is legitimately pre-match-only).
    for match_id in newly_finished_match_ids:
        sync_player_stats_for_match(match_id)
        sync_match_statistics(match_id)
        sync_match_events(match_id)  # must run before the recap so scorers exist
        sync_lineup_for_match(match_id)
        # Feed: create the single full-time match_object recap post (CLAUDE.md
        # 36.2 / Step 2). Guarded so a feed-side failure can't break match sync.
        try:
            from feed.services import create_match_recap_post
            create_match_recap_post(match_id)
        except Exception as exc:  # pragma: no cover - defensive
            print(f"recap post creation failed for match {match_id}: {exc}")

    return f"Checked {candidates.count()} candidates, {len(newly_finished_league_ids)} leagues need resync"


@shared_task
def resync_league_after_match(league_id, season):
    """Triggered immediately when a match in this league just finished."""
    from leagues.tasks import sync_standings_for_league, sync_player_stats_for_league
    sync_standings_for_league(league_id, season)
    sync_player_stats_for_league(league_id, season)
    return f"Resynced league {league_id} season {season} after match completion"


def sync_player_stats_for_match(match_id):
    """Sync per-player stats for a single finished match."""
    from .models import Match, PlayerMatchStat
    from .api_football_client import api_football_client

    match = Match.objects.filter(id=match_id).first()
    if not match:
        return "Match not found"

    data = api_football_client._get('fixtures/players', params={'fixture': match.api_football_id})
    if not data:
        return "No player stats available"

    synced = 0
    for team_entry in data:
        team_id = (team_entry.get('team') or {}).get('id')
        for player_entry in team_entry.get('players', []):
            player_info = player_entry.get('player') or {}
            stats_list = player_entry.get('statistics') or []
            stat = stats_list[0] if stats_list else {}
            games_info = stat.get('games') or {}
            goals_info = stat.get('goals') or {}
            cards_info = stat.get('cards') or {}

            PlayerMatchStat.objects.update_or_create(
                match=match, player_id=player_info.get('id'),
                defaults={
                    'player_name': player_info.get('name', ''),
                    'team_id': team_id,
                    'minutes': games_info.get('minutes'),
                    'rating': games_info.get('rating'),
                    'position': games_info.get('position'),
                    'goals': goals_info.get('total') or 0,
                    'assists': goals_info.get('assists') or 0,
                    'yellow_cards': cards_info.get('yellow') or 0,
                    'red_cards': cards_info.get('red') or 0,
                    'full_stats': stat,
                }
            )
            synced += 1
    return f"Synced {synced} player stats for match {match_id}"


def sync_odds_for_match(match_id):
    """
    Sync pre-match odds for a single fixture. Not a Celery task since it's
    meant to be called on-demand (e.g. when a user opens the Odds tab),
    same convention as sync_player_stats_for_match.

    NOTE: API-Football's /odds endpoint only retains data for fixtures within
    a ~7-day window before kickoff, so this will return "No odds available"
    for anything outside that window even if the match itself is synced.
    """
    from .models import Match, MatchOdds
    from .api_football_client import api_football_client

    match = Match.objects.filter(id=match_id).first()
    if not match:
        return "Match not found"

    data = api_football_client._get('odds', params={'fixture': match.api_football_id})
    if not data:
        return "No odds available (outside 7-day window or not yet posted)"

    bookmaker_data = data[0].get('bookmakers', [{}])[0] if data else {}
    MatchOdds.objects.update_or_create(
        match=match,
        defaults={'bookmaker_name': bookmaker_data.get('name', ''), 'data': data[0]}
    )
    return f"Synced odds for match {match_id}"


def sync_lineup_for_match(match_id):
    """
    Sync starting XI/subs/formation for a single fixture. Not a Celery task
    since it's meant to be called on-demand (e.g. when a user opens the
    Lineup tab), same convention as sync_odds_for_match.

    NOTE: API-Football only posts lineups shortly before kickoff (~30-60 min),
    so this will return "No lineup available yet" for anything earlier.
    """
    from .models import Match, MatchLineup
    from .api_football_client import api_football_client

    match = Match.objects.filter(id=match_id).first()
    if not match:
        return "Match not found"

    data = api_football_client._get('fixtures/lineups', params={'fixture': match.api_football_id})
    if not data:
        return "No lineup available yet"

    MatchLineup.objects.update_or_create(match=match, defaults={'data': data})
    return f"Synced lineup for match {match_id}"


def sync_match_statistics(match_id):
    """Sync team-level match statistics (shots, possession, etc.) for a finished match."""
    from .models import Match
    from .api_football_client import api_football_client

    match = Match.objects.filter(id=match_id).first()
    if not match:
        return "Match not found"
    data = api_football_client._get('fixtures/statistics', params={'fixture': match.api_football_id})
    if not data:
        return "No statistics available"
    match.live_stats = data
    match.save()
    return f"Synced statistics for match {match_id}"


def _sync_events_core(match):
    """Upsert all events for a match from API-Football; return
    (synced_count, [newly_created MatchEvent]). Shared by the one-shot
    finish-time sync (sync_match_events) and the live poller
    (sync_live_match_events), so the live diff and the backfill use identical
    upsert logic."""
    from .models import MatchEvent
    from .api_football_client import api_football_client

    data = api_football_client._get('fixtures/events', params={'fixture': match.api_football_id})
    if not data:
        return 0, []

    TYPE_MAP = {'Goal': 'goal', 'Card': 'yellow_card', 'subst': 'substitution', 'Var': 'var'}
    synced = 0
    new_events = []
    for event in data:
        event_type = TYPE_MAP.get(event['type'], 'other')
        if event['type'] == 'Card' and event.get('detail') == 'Red Card':
            event_type = 'red_card'
        player_info = event.get('player') or {}
        team_info = event.get('team') or {}
        assist_info = event.get('assist') or {}
        # update_or_create (not get_or_create) so re-running this sync
        # refreshes assist_player/team/detail on rows that already exist,
        # rather than silently leaving them stale — needed for backfilling
        # assist data onto matches synced before this field existed.
        obj, created = MatchEvent.objects.update_or_create(
            match=match,
            event_type=event_type,
            player=player_info.get('name', ''),
            minute=(event.get('time') or {}).get('elapsed', 0),
            defaults={
                'team': team_info.get('name', ''),
                'detail': event.get('detail', ''),
                'assist_player': assist_info.get('name'),
            }
        )
        synced += 1
        if created:
            new_events.append(obj)
    return synced, new_events


def sync_match_events(match_id):
    """Sync goal/card/substitution events for a finished match (one-shot)."""
    from .models import Match

    match = Match.objects.filter(id=match_id).first()
    if not match:
        return "Match not found"
    synced, _ = _sync_events_core(match)
    return f"Synced {synced} events for match {match_id}"


def broadcast_match_event(match, event):
    """Broadcast a new live event into the match's EXISTING MatchRoom Channels
    group (group name `match_{pk}`, consumer handler `match_event`) — Section
    3.5 reuse, no new WebSocket infrastructure (CLAUDE.md 36.4 / Step 8)."""
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    layer = get_channel_layer()
    if layer is None:
        return
    async_to_sync(layer.group_send)(
        f'match_{match.id}',
        {
            'type': 'match_event',  # → MatchConsumer.match_event
            'event': {
                'id': event.id,
                'event_type': event.event_type,
                'team': event.team,
                'player': event.player,
                'assist_player': event.assist_player,
                'minute': event.minute,
                'detail': event.detail,
            },
            'match': {
                'id': match.id,
                'home_score': match.home_score,
                'away_score': match.away_score,
                'minute': match.minute,
                'status': match.status,
            },
        },
    )


@shared_task
def sync_live_match_events():
    """Live-event poller (CLAUDE.md 36.4 / Step 8), ~every 60s — distinct from
    check_for_finished_matches' 3-min cycle. Scans status='live' matches, diffs
    the current event list against stored MatchEvent rows, and for each NEW
    event fans out two ways: a WebSocket broadcast into the match room, and a
    separate async notification task (not inline, so one popular match doesn't
    block the poller)."""
    from .models import Match

    live = list(Match.objects.filter(status='live'))
    total_new = 0
    for match in live:
        _, new_events = _sync_events_core(match)
        for ev in new_events:
            broadcast_match_event(match, ev)
            # Separate async task — never inline (36.4).
            from notifications.tasks import fan_out_match_event_notification
            fan_out_match_event_notification.delay(ev.id)
        total_new += len(new_events)
    return f"live poll: {len(live)} live matches, {total_new} new events"
