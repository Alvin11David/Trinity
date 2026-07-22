"""
Backfill match_object recap posts for already-finished matches.

Going forward, recaps are created automatically by check_for_finished_matches
(Section 30) the moment a match flips to 'finished'. This command creates recaps
for matches that finished *before* that hook was wired (CLAUDE.md 36.2 / Step 2),
and is the idempotent, repeatable path to run against a fresh production DB
(same pattern as the other sync backfills — Section 17).

Only matches that have at least one synced goal MatchEvent are recapped by
default, since a recap with no derivable score/scorers isn't useful; pass
--all-finished to recap every finished match regardless.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create match_object recap posts for finished matches (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            '--all-finished', action='store_true',
            help='Recap every finished match, not just those with synced goal events.',
        )
        parser.add_argument(
            '--limit', type=int, default=None,
            help='Cap the number of matches processed (useful for a test run).',
        )

    def handle(self, *args, **options):
        from matches.models import Match, MatchEvent
        from feed.services import create_match_recap_post

        qs = Match.objects.filter(status='finished')
        if not options['all_finished']:
            match_ids_with_goals = (
                MatchEvent.objects.filter(event_type='goal')
                .values_list('match_id', flat=True).distinct()
            )
            qs = qs.filter(id__in=list(match_ids_with_goals))

        qs = qs.order_by('kickoff_time')
        if options['limit']:
            qs = qs[:options['limit']]

        created = 0
        skipped = 0
        for match in qs:
            post = create_match_recap_post(match.id)
            if post:
                created += 1
                self.stdout.write(
                    f"  recap #{post.id}: {match.home_team.name if match.home_team_id else '?'} "
                    f"{match.home_score}-{match.away_score} "
                    f"{match.away_team.name if match.away_team_id else '?'}"
                )
            else:
                skipped += 1

        self.stdout.write(self.style.SUCCESS(
            f"Done. Created {created} recap(s), skipped {skipped} (already existed / not finished)."
        ))
