from django.db import migrations


class Migration(migrations.Migration):
    """Phase 5: drop denormalized favorite_team_id/name/logo from User and rename
    the Phase-3 FK favorite_team_ref -> favorite_team. Hand-written so the rename
    is explicit (no data-losing drop+recreate). The int favorite_team_id is
    dropped first so the FK column can rename favorite_team_ref_id ->
    favorite_team_id without colliding."""

    dependencies = [
        ('users', '0008_backfill_favorite_team_fk'),
    ]

    operations = [
        migrations.RemoveField(model_name='user', name='favorite_team_id'),
        migrations.RemoveField(model_name='user', name='favorite_team_name'),
        migrations.RemoveField(model_name='user', name='favorite_team_logo'),
        migrations.RenameField(model_name='user', old_name='favorite_team_ref', new_name='favorite_team'),
    ]
