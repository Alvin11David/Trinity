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
                team_id=team_entry['team']['id'],
                defaults={
                    'league_name': league_info['name'],
                    'team_name': team_entry['team']['name'],
                    'team_logo': team_entry['team']['logo'],
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
                    'team_id': team_info.get('id'),
                    'team_name': team_info.get('name', ''),
                    'team_logo': team_info.get('logo'),
                    'goals': goals_info.get('total') or 0,
                    'assists': goals_info.get('assists') or 0,
                    'appearances': games_info.get('appearences') or 0,
                    'rank_position': position,
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
