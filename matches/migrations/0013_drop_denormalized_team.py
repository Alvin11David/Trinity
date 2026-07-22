from django.db import migrations


class Migration(migrations.Migration):
    """Phase 5: drop denormalized team fields on Match/MatchEvent/PlayerMatchStat
    and rename the Phase-3 FKs to their final names. Hand-written so renames are
    explicit (no data-losing drop+recreate). For Match the string names + int ids
    + logos are removed first so home_team_ref -> home_team can take over the
    home_team name / home_team_id column. After this, match.home_team is a Team
    object (not a name string); home_team_id/away_team_id still work as attnames."""

    dependencies = [
        ('matches', '0012_backfill_team_fks'),
    ]

    operations = [
        # --- Match ---
        migrations.RemoveField(model_name='match', name='home_team'),
        migrations.RemoveField(model_name='match', name='away_team'),
        migrations.RemoveField(model_name='match', name='home_team_id'),
        migrations.RemoveField(model_name='match', name='away_team_id'),
        migrations.RemoveField(model_name='match', name='home_team_logo'),
        migrations.RemoveField(model_name='match', name='away_team_logo'),
        migrations.RenameField(model_name='match', old_name='home_team_ref', new_name='home_team'),
        migrations.RenameField(model_name='match', old_name='away_team_ref', new_name='away_team'),

        # --- MatchEvent ---
        migrations.RemoveField(model_name='matchevent', name='team'),
        migrations.RenameField(model_name='matchevent', old_name='team_ref', new_name='team'),

        # --- PlayerMatchStat ---
        migrations.RemoveField(model_name='playermatchstat', name='team_id'),
        migrations.RenameField(model_name='playermatchstat', old_name='team_ref', new_name='team'),
    ]
