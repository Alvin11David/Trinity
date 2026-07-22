from django.db import migrations


# Every id-bearing denormalized team column across the app, richest/most
# authoritative source FIRST so its name/logo wins when the same team_id shows
# up in several tables. Each entry: (app.Model, [(id_field, name_field, logo_field), ...]).
# name/logo may be None when that table doesn't carry it.
# NOTE: matches.MatchEvent is intentionally absent — it stores a team NAME only
# (no id), so it can't seed a Team here; it's resolved in a later phase.
SOURCES = [
    ('leagues.LeagueStanding',      [('team_id', 'team_name', 'team_logo')]),
    ('leagues.TeamStatistics',      [('team_id', 'team_name', 'team_logo')]),
    ('leagues.PlayerLeagueStat',    [('team_id', 'team_name', 'team_logo')]),
    ('leagues.UserTeamFollow',      [('team_id', 'team_name', 'team_logo')]),
    ('users.User',                  [('favorite_team_id', 'favorite_team_name', 'favorite_team_logo')]),
    ('matches.Match',               [('home_team_id', 'home_team', 'home_team_logo'),
                                     ('away_team_id', 'away_team', 'away_team_logo')]),
    ('players.Player',              [('team_id', 'team_name', None)]),
    ('leagues.LeagueTeamSyncStatus', [('team_id', 'team_name', None)]),
    ('matches.PlayerMatchStat',     [('team_id', None, None)]),
]


def backfill_teams(apps, schema_editor):
    Team = apps.get_model('teams', 'Team')

    # id -> {'name': str, 'logo': str|None}, first non-empty value wins.
    collected = {}
    for label, specs in SOURCES:
        app_label, model_name = label.split('.')
        Model = apps.get_model(app_label, model_name)
        for id_f, name_f, logo_f in specs:
            fields = [id_f] + [f for f in (name_f, logo_f) if f]
            for row in Model.objects.values_list(*fields).distinct():
                team_id = row[0]
                if not team_id:  # None or 0 -> not a real team reference
                    continue
                idx = 1
                name = ''
                logo = None
                if name_f:
                    name = row[idx] or ''
                    idx += 1
                if logo_f:
                    logo = row[idx] or None
                entry = collected.setdefault(team_id, {'name': '', 'logo': None})
                if not entry['name'] and name:
                    entry['name'] = name
                if not entry['logo'] and logo:
                    entry['logo'] = logo

    created = 0
    filled = 0
    for team_id, data in collected.items():
        team, was_created = Team.objects.get_or_create(
            pk=team_id,
            defaults={'name': data['name'], 'logo': data['logo']},
        )
        if was_created:
            created += 1
            continue
        # Existing row (e.g. from SyncTeamsView) — only fill genuinely blank
        # identity fields, never overwrite authoritative data.
        dirty = []
        if not team.name and data['name']:
            team.name = data['name']
            dirty.append('name')
        if not team.logo and data['logo']:
            team.logo = data['logo']
            dirty.append('logo')
        if dirty:
            team.save(update_fields=dirty + ['updated_at'])
            filled += 1

    print(f"\n  [teams backfill] {len(collected)} distinct team ids -> "
          f"{created} created, {filled} existing rows filled")


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0001_initial'),
        ('matches', '0010_matchevent_assist_player'),
        ('leagues', '0010_userteamfollow'),
        ('players', '0002_country'),
        ('users', '0006_user_favorite_team_logo'),
    ]

    operations = [
        # Reverse is a no-op: once teams exist we can't tell backfilled rows from
        # authoritatively-synced ones, so unmigrating must not delete them.
        migrations.RunPython(backfill_teams, migrations.RunPython.noop),
    ]
