import requests
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class WinnieClient:
    """
    Handles all communication with Winnie's prediction API.
    Winnie owns the ML/prediction logic; Ball just consumes it.
    """

    def __init__(self):
        self.base_url = settings.WINNIE_API_BASE_URL
        self.timeout = 5

    def _get(self, endpoint, params=None):
        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            logger.warning(f"Winnie API timeout: {url}")
            return None
        except requests.exceptions.ConnectionError:
            logger.warning(f"Winnie API unreachable: {url}")
            return None
        except requests.exceptions.HTTPError as e:
            logger.warning(f"Winnie API error {e.response.status_code}: {url}")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"Winnie API unexpected error: {url} - {str(e)}")
            return None

    def get_leagues(self):
        return self._get('/api/leagues/')

    def get_fixtures(self, league=None):
        params = {'league': league} if league else None
        return self._get('/api/fixtures/', params=params)

    def get_predictions(self, league=None):
        params = {'league': league} if league else None
        return self._get('/api/predictions/', params=params)

    def get_prediction_for_match(self, match_id):
        return self._get(f'/api/predictions/{match_id}/')

    def get_results(self, league=None):
        params = {'league': league} if league else None
        return self._get('/api/results/', params=params)

    def get_standings(self, league=None):
        params = {'league': league} if league else None
        return self._get('/api/standings/', params=params)


# Single shared instance to use across the app
winnie_client = WinnieClient()