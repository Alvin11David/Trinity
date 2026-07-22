from django.db import migrations


class Migration(migrations.Migration):
    """Phase 5: drop denormalized team_id/team_name/team_logo across the leagues
    models and rename the Phase-3 FK team_ref -> team. Hand-written so each rename
    is explicit (no data-losing drop+recreate). For models with a unique_together
    on team_id, the constraint is dropped first (AlterUniqueTogether -> empty),
    then the columns, then the FK is renamed, then the constraint is re-added on
    the FK. team_id keeps working everywhere as the FK's attname."""

    dependencies = [
        ('leagues', '0012_backfill_team_fks'),
    ]

    operations = [
        # --- LeagueStanding ---
        migrations.AlterUniqueTogether(name='leaguestanding', unique_together=set()),
        migrations.RemoveField(model_name='leaguestanding', name='team_id'),
        migrations.RemoveField(model_name='leaguestanding', name='team_name'),
        migrations.RemoveField(model_name='leaguestanding', name='team_logo'),
        migrations.RenameField(model_name='leaguestanding', old_name='team_ref', new_name='team'),
        migrations.AlterUniqueTogether(
            name='leaguestanding', unique_together={('league_id', 'season', 'team')}
        ),

        # --- PlayerLeagueStat (no team in unique_together) ---
        migrations.RemoveField(model_name='playerleaguestat', name='team_id'),
        migrations.RemoveField(model_name='playerleaguestat', name='team_name'),
        migrations.RemoveField(model_name='playerleaguestat', name='team_logo'),
        migrations.RenameField(model_name='playerleaguestat', old_name='team_ref', new_name='team'),

        # --- TeamStatistics ---
        migrations.AlterUniqueTogether(name='teamstatistics', unique_together=set()),
        migrations.RemoveField(model_name='teamstatistics', name='team_id'),
        migrations.RemoveField(model_name='teamstatistics', name='team_name'),
        migrations.RemoveField(model_name='teamstatistics', name='team_logo'),
        migrations.RenameField(model_name='teamstatistics', old_name='team_ref', new_name='team'),
        migrations.AlterUniqueTogether(
            name='teamstatistics', unique_together={('league_id', 'team', 'season')}
        ),

        # --- UserTeamFollow ---
        migrations.AlterUniqueTogether(name='userteamfollow', unique_together=set()),
        migrations.RemoveField(model_name='userteamfollow', name='team_id'),
        migrations.RemoveField(model_name='userteamfollow', name='team_name'),
        migrations.RemoveField(model_name='userteamfollow', name='team_logo'),
        migrations.RenameField(model_name='userteamfollow', old_name='team_ref', new_name='team'),
        migrations.AlterUniqueTogether(
            name='userteamfollow', unique_together={('user', 'team')}
        ),

        # --- LeagueTeamSyncStatus ---
        migrations.AlterUniqueTogether(name='leagueteamsyncstatus', unique_together=set()),
        migrations.RemoveField(model_name='leagueteamsyncstatus', name='team_id'),
        migrations.RemoveField(model_name='leagueteamsyncstatus', name='team_name'),
        migrations.RenameField(model_name='leagueteamsyncstatus', old_name='team_ref', new_name='team'),
        migrations.AlterUniqueTogether(
            name='leagueteamsyncstatus', unique_together={('league_id', 'season', 'team')}
        ),
    ]
