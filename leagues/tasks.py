from celery import shared_task
from django.utils import timezone


@shared_task
def sync_all_featured_standings():
    """Sync standings for every featured league. Runs hourly per API-Football's guidance."""
    from .models import League
    from matches.api_football_client import api_football_client
    from .models import LeagueStanding

    featured_leagues = League.objects.filter(is_featured=True).exclude(current_season__isnull=True)
    synced_count = 0

    for league in featured_leagues:
        data = api_football_client.get_standings(league_id=league.league_id, season=league.current_season)
        if not data:
            continue
        for league_entry in data:
            league_info = league_entry['league']
            standings_table = league_info['standings'][0]
            for team_entry in standings_table:
                LeagueStanding.objects.update_or_create(
                    league_id=league.league_id,
                    season=league.current_season,
                    team_id=team_entry['team']['id'],
                    defaults={
                        'league_name': league_info['name'],
                        'team_name': team_entry['team']['name'],
                        'team_logo': team_entry['team']['logo'],
                        'rank': team_entry['rank'],
                        'points': team_entry['points'],
                        'goals_diff': team_entry['goalsDiff'],
                        'form': team_entry.get('form', ''),
                        'description': team_entry.get('description'),
                        'played': team_entry['all']['played'],
                        'win': team_entry['all']['win'],
                        'draw': team_entry['all']['draw'],
                        'lose': team_entry['all']['lose'],
                        'goals_for': team_entry['all']['goals']['for'],
                        'goals_against': team_entry['all']['goals']['against'],
                    }
                )
        synced_count += 1

    return f"Synced standings for {synced_count} leagues"
