from django.db import models


class LeagueStanding(models.Model):
    league_id = models.IntegerField()  # API-Football league ID (e.g. 39 for EPL)
    league_name = models.CharField(max_length=100)
    season = models.IntegerField()
    team_id = models.IntegerField()
    team_name = models.CharField(max_length=100)
    team_logo = models.URLField(blank=True, null=True)
    rank = models.IntegerField()
    points = models.IntegerField()
    goals_diff = models.IntegerField()
    form = models.CharField(max_length=10, blank=True)
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
    goals = models.IntegerField(default=0)
    assists = models.IntegerField(default=0)
    appearances = models.IntegerField(default=0)
    rank_type = models.CharField(max_length=20)
    rank_position = models.IntegerField()
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
    form = models.CharField(max_length=100, blank=True)
    data = models.JSONField()
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('league_id', 'team_id', 'season')

    def __str__(self):
        return f"{self.team_name} stats - {self.season}"
