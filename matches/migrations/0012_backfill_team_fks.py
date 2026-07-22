from django.db import migrations
from django.db.models import F


def backfill(apps, schema_editor):
    Team = apps.get_model('teams', 'Team')
    Match = apps.get_model('matches', 'Match')
    PlayerMatchStat = apps.get_model('matches', 'PlayerMatchStat')
    MatchEvent = apps.get_model('matches', 'MatchEvent')

    valid = set(Team.objects.values_list('pk', flat=True))

    h = Match.objects.filter(home_team_id__in=valid).update(home_team_ref_id=F('home_team_id'))
    a = Match.objects.filter(away_team_id__in=valid).update(away_team_ref_id=F('away_team_id'))
    p = PlayerMatchStat.objects.filter(team_id__in=valid).update(team_ref_id=F('team_id'))

    # MatchEvent has no team id — resolve its team NAME against the parent match's
    # two teams (whose FKs we just set above).
    ev_updated = 0
    batch = []
    qs = MatchEvent.objects.select_related('match').filter(team_ref_id__isnull=True)
    for ev in qs.iterator(chunk_size=2000):
        m = ev.match
        ref = None
        if ev.team and ev.team == m.home_team:
            ref = m.home_team_ref_id
        elif ev.team and ev.team == m.away_team:
            ref = m.away_team_ref_id
        if ref:
            ev.team_ref_id = ref
            batch.append(ev)
            if len(batch) >= 2000:
                MatchEvent.objects.bulk_update(batch, ['team_ref'])
                ev_updated += len(batch)
                batch = []
    if batch:
        MatchEvent.objects.bulk_update(batch, ['team_ref'])
        ev_updated += len(batch)

    print(f"\n  [matches FK backfill] Match home={h} away={a}, "
          f"PlayerMatchStat={p}, MatchEvent(by name)={ev_updated}")


class Migration(migrations.Migration):

    dependencies = [
        ('matches', '0011_match_away_team_ref_match_home_team_ref_and_more'),
        ('teams', '0002_backfill_teams'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
