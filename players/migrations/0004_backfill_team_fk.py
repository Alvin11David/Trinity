from django.db import migrations
from django.db.models import F


def backfill(apps, schema_editor):
    Team = apps.get_model('teams', 'Team')
    Player = apps.get_model('players', 'Player')
    valid = set(Team.objects.values_list('pk', flat=True))
    n = Player.objects.filter(team_id__in=valid).update(team_ref_id=F('team_id'))
    print(f"\n  [players FK backfill] Player={n}")


class Migration(migrations.Migration):

    dependencies = [
        ('players', '0003_player_team_ref'),
        ('teams', '0002_backfill_teams'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
