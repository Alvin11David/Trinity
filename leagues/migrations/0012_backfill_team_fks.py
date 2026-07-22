from django.db import migrations
from django.db.models import F


def backfill(apps, schema_editor):
    Team = apps.get_model('teams', 'Team')
    valid = set(Team.objects.values_list('pk', flat=True))

    results = {}
    for model_name in ('LeagueStanding', 'PlayerLeagueStat', 'TeamStatistics',
                       'UserTeamFollow', 'LeagueTeamSyncStatus'):
        Model = apps.get_model('leagues', model_name)
        results[model_name] = (
            Model.objects.filter(team_id__in=valid).update(team_ref_id=F('team_id'))
        )

    print(f"\n  [leagues FK backfill] {results}")


class Migration(migrations.Migration):

    dependencies = [
        ('leagues', '0011_leaguestanding_team_ref_and_more'),
        ('teams', '0002_backfill_teams'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
