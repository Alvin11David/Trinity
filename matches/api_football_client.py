import requests
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class APIFootballClient:
    """
    Handles all communication with API-Football (v3.football.api-sports.io).
    Used for broad league/team/player browsing data — separate from Winnie,
    which only covers 5 leagues with ML predictions.
    """

    def __init__(self):
        self.base_url = settings.API_FOOTBALL_BASE_URL
        self.headers = {'x-apisports-key': settings.API_FOOTBALL_KEY}
        self.timeout = 8

    def _get(self, endpoint, params=None, return_full=False):
        url = f"{self.base_url}/{endpoint}"
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=self.timeout)
            response.raise_for_status()
            data = response.json()
            if data.get('errors'):
                logger.warning(f"API-Football returned errors: {data['errors']} for {url}")
                return None
            if return_full:
                return data
            return data.get('response')
        except requests.exceptions.Timeout:
            logger.warning(f"API-Football timeout: {url}")
            return None
        except requests.exceptions.ConnectionError:
            logger.warning(f"API-Football unreachable: {url}")
            return None
        except requests.exceptions.HTTPError as e:
            logger.warning(f"API-Football HTTP error {e.response.status_code}: {url}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"API-Football unexpected error: {url} - {str(e)}")
            return None

    def get_status(self):
        """Check account status/quota. Does not count against daily quota."""
        return self._get('status')

    def get_countries(self):
        return self._get('countries')

    def get_leagues(self, country=None, search=None):
        params = {}
        if country:
            params['country'] = country
        if search:
            params['search'] = search
        return self._get('leagues', params=params)

    def get_standings(self, league_id, season):
        return self._get('standings', params={'league': league_id, 'season': season})

    def get_fixtures(self, league_id=None, season=None, team_id=None, date=None, live=None):
        params = {}
        if league_id:
            params['league'] = league_id
        if season:
            params['season'] = season
        if team_id:
            params['team'] = team_id
        if date:
            params['date'] = date
        if live:
            params['live'] = live
        return self._get('fixtures', params=params)

    def get_team(self, team_id):
        return self._get('teams', params={'id': team_id})

    def get_team_statistics(self, league_id, team_id, season):
        return self._get('teams/statistics', params={'league': league_id, 'team': team_id, 'season': season})

    def get_squad(self, team_id):
        return self._get('players/squads', params={'team': team_id})

    def get_players(self, team_id, season, page=1):
        return self._get('players', params={'team': team_id, 'season': season, 'page': page}, return_full=True)

    def get_top_scorers(self, league_id, season):
        return self._get('players/topscorers', params={'league': league_id, 'season': season})

    def get_top_assists(self, league_id, season):
        return self._get('players/topassists', params={'league': league_id, 'season': season})


# Single shared instance to use across the app
api_football_client = APIFootballClient()