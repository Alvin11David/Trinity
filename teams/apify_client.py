import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# English mirror. Player/club ids are identical across all 13 mirrors, so this only
# affects the language of resolved labels (position names etc.).
TM_MIRROR = 'com'


class ApifyTransfermarktClient:
    """
    Wraps the Apify `solidcode/transfermarkt-scraper` actor (see ball/TRANSFERMARKT.md).
    Mirrors api_football_client: one shared instance, graceful degradation when the
    token is missing.

    IMPORTANT: `.call()` BLOCKS until the actor run finishes (minutes for a full
    league), so only ever call this from a Celery task / management command, never a
    web request. Runs cost money ($1 / 1000 result rows).
    """

    def __init__(self):
        self.token = settings.APIFY_API_TOKEN
        self.actor = settings.APIFY_TRANSFERMARKT_ACTOR
        self._client = None

    @property
    def enabled(self):
        return bool(self.token)

    def _client_or_none(self):
        if not self.enabled:
            logger.warning('APIFY_API_TOKEN not set — Transfermarkt sync is disabled.')
            return None
        if self._client is None:
            from apify_client import ApifyClient
            self._client = ApifyClient(self.token)
        return self._client

    def run_competition(self, tm_code, max_results=800):
        """Run the actor across a whole competition — every club + every squad player.
        Returns the dataset items (list of dicts, each carrying `recordType`:
        player | club | competition | transfer), or None if disabled / failed."""
        run_input = {
            'startUrls': [f'https://www.transfermarkt.{TM_MIRROR}/-/startseite/wettbewerb/{tm_code}'],
            'recordType': 'auto',
            'includeCompetitionClubs': True,
            'includeClubSquad': True,
            'includeMarketValueHistory': True,
            'includeTransferHistory': True,
            'includeAchievements': False,
            'includeInjuries': False,
            'language': TM_MIRROR,
            'maxResults': max_results,
        }
        return self._run(run_input)

    def run_urls(self, start_urls, max_results=50, **overrides):
        """Lower-level: run for explicit TM player/club URLs (targeted refresh)."""
        run_input = {
            'startUrls': list(start_urls),
            'recordType': 'auto',
            'includeMarketValueHistory': True,
            'includeTransferHistory': True,
            'includeAchievements': False,
            'includeInjuries': False,
            'language': TM_MIRROR,
            'maxResults': max_results,
        }
        run_input.update(overrides)
        return self._run(run_input)

    def _run(self, run_input):
        client = self._client_or_none()
        if not client:
            return None
        try:
            run = client.actor(self.actor).call(run_input=run_input)
        except Exception as e:
            logger.error(f'Apify actor run failed: {e}')
            return None
        # SDK 3.x returns a typed Run object, not a dict.
        run_d = run.model_dump(by_alias=True) if hasattr(run, 'model_dump') else dict(run)
        status = run_d.get('status')
        dataset_id = run_d.get('defaultDatasetId')
        if status != 'SUCCEEDED':
            logger.warning(f'Apify run finished with status {status!r}.')
        if not dataset_id:
            return None
        try:
            return list(client.dataset(dataset_id).iterate_items())
        except Exception as e:
            logger.error(f'Reading Apify dataset {dataset_id} failed: {e}')
            return None


# Single shared instance, like api_football_client.
apify_transfermarkt_client = ApifyTransfermarktClient()
