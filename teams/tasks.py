from celery import shared_task


@shared_task
def sync_transfermarkt_league(league_pk):
    """Run + reconcile a Transfermarkt sync for one League (by PK). Blocks on the
    Apify actor run, so this belongs on a worker, not a web request."""
    from leagues.models import League
    from .transfermarkt import sync_league

    league = League.objects.filter(pk=league_pk).first()
    if not league:
        return f'League pk={league_pk} not found'
    summary = sync_league(league)
    return f'{league.name}: {summary}'


@shared_task
def sync_all_transfermarkt():
    """Sync every League that has a transfermarkt_code (core 5 today)."""
    from leagues.models import League

    results = []
    for league in League.objects.exclude(transfermarkt_code__isnull=True).exclude(transfermarkt_code=''):
        results.append(sync_transfermarkt_league(league.pk))
    return results
