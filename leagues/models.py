from django.db import models


class LeagueStanding(models.Model):
    league_id = models.IntegerField()  # API-Football league ID (e.g. 39 for EPL)
    league_name = models.CharField(max_length=100)
    season = models.IntegerField()
    team_id = models.IntegerField()
    team_name = models.CharField(max_length=100)
    team_logo = models.URLField(blank=True, null=True)
    # Team FK migration (Phase 3): nullable ref alongside team_id, backfilled from it.
    team_ref = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    rank = models.IntegerField()
    points = models.IntegerField()
    goals_diff = models.IntegerField()
    form = models.CharField(max_length=10, blank=True, null=True, default='')
    description = models.CharField(max_length=200, blank=True, null=True)
    played = models.IntegerField()
    win = models.IntegerField()
    draw = models.IntegerField()
    lose = models.IntegerField()
    goals_for = models.IntegerField()
    goals_against = models.IntegerField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('league_id', 'season', 'team_id')
        ordering = ['league_id', 'rank']

    def __str__(self):
        return f"{self.team_name} - {self.league_name} ({self.season})"


class PlayerLeagueStat(models.Model):
    league_id = models.IntegerField()
    season = models.IntegerField()
    player_id = models.IntegerField()
    player_name = models.CharField(max_length=150)
    player_photo = models.URLField(blank=True, null=True)
    team_id = models.IntegerField()
    team_name = models.CharField(max_length=100)
    team_logo = models.URLField(blank=True, null=True)
    # Team FK migration (Phase 3): nullable ref alongside team_id, backfilled from it.
    team_ref = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    goals = models.IntegerField(default=0)
    assists = models.IntegerField(default=0)
    appearances = models.IntegerField(default=0)
    rank_type = models.CharField(max_length=20)
    rank_position = models.IntegerField()
    full_stats = models.JSONField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('league_id', 'season', 'player_id', 'rank_type')
        ordering = ['rank_type', 'rank_position']

    def __str__(self):
        return f"{self.player_name} - {self.rank_type} #{self.rank_position}"


class TeamStatistics(models.Model):
    league_id = models.IntegerField()
    team_id = models.IntegerField()
    season = models.IntegerField()
    team_name = models.CharField(max_length=100)
    team_logo = models.URLField(blank=True, null=True)
    # Team FK migration (Phase 3): nullable ref alongside team_id, backfilled from it.
    team_ref = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    form = models.CharField(max_length=100, blank=True)
    data = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('league_id', 'team_id', 'season')

    def __str__(self):
        return f"{self.team_name} stats - {self.season}"


class League(models.Model):
    league_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=150)
    league_type = models.CharField(max_length=30, blank=True, null=True)
    logo = models.URLField(blank=True, null=True)
    country_name = models.CharField(max_length=100, blank=True, null=True)
    country_code = models.CharField(max_length=10, blank=True, null=True)
    country_flag = models.URLField(blank=True, null=True)
    current_season = models.IntegerField(null=True, blank=True)
    is_core_league = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['country_name', 'name']

    def __str__(self):
        return f"{self.name} ({self.country_name})"


class UserLeagueFollow(models.Model):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='followed_leagues')
    league = models.ForeignKey(League, on_delete=models.CASCADE, related_name='followers')
    order = models.IntegerField(default=0)  # for custom reordering, like FotMob's drag handles
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'league')
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.user.username} follows {self.league.name}"


class UserTeamFollow(models.Model):
    """
    A user following a football team. Denormalized (team_id/team_name/logo) —
    there is NO Team model anywhere in the codebase; Match/TeamStatistics/
    LeagueStanding all carry denormalized team_id/team_name, and this mirrors
    that convention (Section 38 reconciliation decision).

    Hard prerequisite for notification fan-out (CLAUDE.md 36.4 / Step 8:
    "followers of either team") and the affinity TEAM tier in Discovery
    scoring (36.6 / Step 5). Sibling of UserLeagueFollow above.
    """
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='followed_teams')
    team_id = models.IntegerField()  # API-Football numeric team ID
    team_name = models.CharField(max_length=100, blank=True)
    team_logo = models.URLField(blank=True, null=True)
    # Team FK migration (Phase 3): nullable ref alongside team_id, backfilled from it.
    team_ref = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'team_id')
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.user.username} follows team {self.team_name or self.team_id}"


class LeagueTeamSyncStatus(models.Model):
    league_id = models.IntegerField()
    season = models.IntegerField()
    team_id = models.IntegerField()
    team_name = models.CharField(max_length=100, blank=True)
    # Team FK migration (Phase 3): nullable ref alongside team_id, backfilled from it.
    team_ref = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    players_synced = models.BooleanField(default=False)
    synced_at = models.DateTimeField(null=True, blank=True)
    error = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ('league_id', 'season', 'team_id')
