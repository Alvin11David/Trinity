from celery import shared_task
from django.utils import timezone


def sync_standings_for_league(league_id, season):
    """
    Fetch and persist standings for a single league/season.
    Returns the number of team rows updated, or None if the API call
    failed / returned nothing.
    """
    from matches.api_football_client import api_football_client
    from .models import LeagueStanding
    from teams.models import Team

    data = api_football_client.get_standings(league_id=league_id, season=season)
    if not data:
        return None

    updated_count = 0
    for league_entry in data:
        league_info = league_entry['league']
        standings_table = league_info['standings'][0]
        for team_entry in standings_table:
            LeagueStanding.objects.update_or_create(
                league_id=league_id,
                season=season,
                team=Team.ensure(team_entry['team']['id'], team_entry['team']['name'], team_entry['team']['logo']),
                defaults={
                    'league_name': league_info['name'],
                    'rank': team_entry['rank'] or 0,
                    'points': team_entry['points'] or 0,
                    'goals_diff': team_entry['goalsDiff'] or 0,
                    'form': team_entry.get('form') or '',
                    'description': team_entry.get('description'),
                    'played': team_entry['all']['played'] or 0,
                    'win': team_entry['all']['win'] or 0,
                    'draw': team_entry['all']['draw'] or 0,
                    'lose': team_entry['all']['lose'] or 0,
                    'goals_for': team_entry['all']['goals']['for'] or 0,
                    'goals_against': team_entry['all']['goals']['against'] or 0,
                }
            )
            updated_count += 1

    return updated_count


def sync_player_stats_for_league(league_id, season):
    """
    Fetch and persist top-scorer/top-assist stats for a single league/season.
    Returns the number of player rows updated.
    """
    from matches.api_football_client import api_football_client
    from .models import PlayerLeagueStat
    from teams.models import Team

    updated_count = 0

    for rank_type, fetch_fn in [
        ('scorer', api_football_client.get_top_scorers),
        ('assist', api_football_client.get_top_assists),
    ]:
        data = fetch_fn(league_id=league_id, season=season)
        if not data:
            continue

        for position, entry in enumerate(data, start=1):
            player_info = entry['player']
            stat = entry['statistics'][0] if entry.get('statistics') else {}
            team_info = stat.get('team', {})
            games_info = stat.get('games', {})
            goals_info = stat.get('goals', {})

            PlayerLeagueStat.objects.update_or_create(
                league_id=league_id,
                season=season,
                player_id=player_info['id'],
                rank_type=rank_type,
                defaults={
                    'player_name': player_info['name'],
                    'player_photo': player_info.get('photo'),
                    'team': Team.ensure(team_info.get('id'), team_info.get('name'), team_info.get('logo')),
                    'goals': goals_info.get('total') or 0,
                    'assists': goals_info.get('assists') or 0,
                    'appearances': games_info.get('appearences') or 0,
                    'rank_position': position,
                    'full_stats': stat,
                }
            )
            updated_count += 1

    return updated_count


@shared_task
def sync_all_featured_standings():
    """
    Daily safety-net sync for every featured league. The primary path for
    keeping standings fresh is event-driven (see matches.tasks.check_for_finished_matches),
    which resyncs a league immediately after one of its matches finishes.
    This catches anything that path might have missed (e.g. Celery downtime).
    """
    from .models import League

    featured_leagues = League.objects.filter(is_featured=True).exclude(current_season__isnull=True)
    synced_count = 0

    for league in featured_leagues:
        result = sync_standings_for_league(league.league_id, league.current_season)
        if result is not None:
            synced_count += 1

    return f"Synced standings for {synced_count} leagues"


@shared_task
def discover_teams_for_league(league_id, season):
    """Fetch and record every team in a league/season, creating tracking rows."""
    from matches.api_football_client import api_football_client
    from .models import LeagueTeamSyncStatus, League
    from teams.models import Team

    # Guard against creating a stale/mistaken-season cohort (e.g. calling
    # with a leftover season value after a season rollover). If we have no
    # League row for this league_id yet, we can't validate against
    # anything, so we let it through rather than block on missing data.
    league = League.objects.filter(league_id=league_id).first()
    if league and league.current_season is not None and season != league.current_season:
        return (
            f"Refused: league {league_id} season {season} does not match "
            f"League.current_season ({league.current_season}). "
            f"Call with season={league.current_season} instead, or update "
            f"League.current_season first if that value is out of date."
        )

    data = api_football_client._get('teams', params={'league': league_id, 'season': season})
    if not data:
        return f"No teams found for league {league_id} season {season}"

    created = 0
    for entry in data:
        team = entry['team']
        _, was_created = LeagueTeamSyncStatus.objects.get_or_create(
            league_id=league_id, season=season,
            # Team.ensure() also refreshes the Team row's name/logo.
            team=Team.ensure(team['id'], team.get('name'), team.get('logo')),
        )
        if was_created:
            created += 1
    return f"Discovered {len(data)} teams for league {league_id}, {created} new"


@shared_task
def sync_next_batch_of_teams(batch_size=20):
    """
    Syncs full player data for up to `batch_size` teams that haven't been
    synced yet. Call this repeatedly (manually or via Beat) to work through
    the full backlog without exceeding quota in one run.
    """
    from django.db.models import F, OuterRef, Subquery
    from .models import LeagueTeamSyncStatus, League
    from players.models import Player
    from matches.api_football_client import api_football_client
    from teams.models import Team

    # Only process rows whose season matches that league's current season.
    # Prevents stale/mistaken-season rows (e.g. a re-discovery run against
    # the wrong season) from ever being silently synced.
    current_season_subquery = League.objects.filter(
        league_id=OuterRef('league_id')
    ).values('current_season')[:1]

    pending = (
        LeagueTeamSyncStatus.objects
        .annotate(league_current_season=Subquery(current_season_subquery))
        .filter(players_synced=False, season=F('league_current_season'))
        .exclude(error__isnull=False)
    )[:batch_size]
    results = []

    for status_row in pending:
        try:
            page = 1
            total_pages = 1
            synced_count = 0
            while page <= total_pages:
                data = api_football_client.get_players(team_id=status_row.team_id, season=status_row.season, page=page)
                if not data or 'response' not in data:
                    break
                total_pages = (data.get('paging') or {}).get('total') or 1
                for entry in data['response']:
                    player_info = entry['player']
                    stats = entry.get('statistics') or []
                    primary_stat = stats[0] if stats else {}
                    team_info = primary_stat.get('team') or {}
                    games_info = primary_stat.get('games') or {}
                    birth_info = player_info.get('birth') or {}
                    Player.objects.update_or_create(
                        api_football_id=player_info['id'],
                        defaults={
                            'team': Team.ensure(
                                team_info.get('id') or status_row.team_id,
                                team_info.get('name') or (status_row.team.name if status_row.team_id else ''),
                                team_info.get('logo'),
                            ),
                            'name': player_info['name'],
                            'first_name': player_info.get('firstname'),
                            'last_name': player_info.get('lastname'),
                            'age': player_info.get('age'),
                            'number': games_info.get('number'),
                            'position': games_info.get('position'),
                            'photo': player_info.get('photo'),
                            'nationality': player_info.get('nationality'),
                            'birth_date': birth_info.get('date'),
                            'birth_place': birth_info.get('place'),
                            'height': player_info.get('height'),
                            'weight': player_info.get('weight'),
                            'injured': player_info.get('injured') or False,
                            'statistics': stats,
                        }
                    )
                    synced_count += 1
                page += 1
                if page > 5:
                    break
            status_row.players_synced = True
            status_row.synced_at = timezone.now()
            status_row.save()
            results.append(f"{status_row.team.name if status_row.team_id else status_row.team_id}: {synced_count} players")
        except Exception as e:
            status_row.error = str(e)
            status_row.save()
            results.append(f"{status_row.team.name if status_row.team_id else status_row.team_id}: ERROR - {str(e)}")

    return f"Processed {len(pending)} teams: " + "; ".join(results)


@shared_task
def sync_team_statistics_for_league(league_id, season):
    """Sync TeamStatistics for every team in a league/season."""
    from .models import LeagueTeamSyncStatus, TeamStatistics
    from matches.api_football_client import api_football_client
    from teams.models import Team

    teams = LeagueTeamSyncStatus.objects.filter(league_id=league_id, season=season)
    synced = 0

    for team_row in teams:
        data = api_football_client.get_team_statistics(league_id=league_id, team_id=team_row.team_id, season=season)
        if not data:
            continue
        team_info = data.get('team') or {}
        TeamStatistics.objects.update_or_create(
            league_id=league_id,
            team=Team.ensure(team_row.team_id, team_info.get('name'), team_info.get('logo')),
            season=season,
            defaults={
                'form': data.get('form') or '',
                'data': data,
            }
        )
        synced += 1

    return f"Synced TeamStatistics for {synced} teams in league {league_id}"
