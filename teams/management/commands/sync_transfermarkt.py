from django.core.management.base import BaseCommand

from leagues.models import League
from teams.transfermarkt import sync_league


class Command(BaseCommand):
    help = ("Run + reconcile Transfermarkt enrichment for leagues that have a "
            "transfermarkt_code. Costs money per run (~$0.50-0.70/league). "
            "Use --code to target one league.")

    def add_arguments(self, parser):
        parser.add_argument('--code', help='Only sync the league with this transfermarkt_code (e.g. GB1).')

    def handle(self, *args, **options):
        qs = League.objects.exclude(transfermarkt_code__isnull=True).exclude(transfermarkt_code='')
        if options.get('code'):
            qs = qs.filter(transfermarkt_code=options['code'])

        leagues = list(qs)
        if not leagues:
            self.stdout.write(self.style.WARNING('No matching leagues with a transfermarkt_code.'))
            return

        for league in leagues:
            self.stdout.write(f'Syncing {league.name} ({league.transfermarkt_code}) …')
            summary = sync_league(league)
            if summary is None:
                self.stdout.write(self.style.ERROR(f'  {league.name}: run failed or disabled.'))
                continue
            self.stdout.write(self.style.SUCCESS(
                f"  {league.name}: clubs {summary['clubs_matched']}✓/{summary['clubs_unmatched']}✗, "
                f"players {summary['players_matched']}✓/{summary['players_unmatched']}✗, "
                f"{summary['mv_rows']} MV rows, {summary['transfer_rows']} transfers"))
