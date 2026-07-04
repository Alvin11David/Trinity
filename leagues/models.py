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
