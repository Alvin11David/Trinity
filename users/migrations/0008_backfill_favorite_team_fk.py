from django.db import migrations
from django.db.models import F


def backfill(apps, schema_editor):
    Team = apps.get_model('teams', 'Team')
    User = apps.get_model('users', 'User')
    valid = set(Team.objects.values_list('pk', flat=True))
    n = (User.objects
         .filter(favorite_team_id__in=valid)
         .update(favorite_team_ref_id=F('favorite_team_id')))
    print(f"\n  [users FK backfill] User.favorite_team={n}")


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_user_favorite_team_ref'),
        ('teams', '0002_backfill_teams'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
