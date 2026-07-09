from django.db import models


class Match(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('live', 'Live'),
        ('finished', 'Finished'),
        ('postponed', 'Postponed'),
    ]

    api_football_id = models.IntegerField(unique=True)
    league = models.CharField(max_length=20, blank=True, null=True)  # now free-text, was choices-limited
    league_id = models.IntegerField(null=True, blank=True)  # API-Football numeric league ID
    league_name = models.CharField(max_length=100, blank=True, null=True)
    round = models.CharField(max_length=100, blank=True, null=True)  # e.g. "Regular Season - 1"
    season = models.IntegerField(null=True, blank=True)

    home_team = models.CharField(max_length=100)
    away_team = models.CharField(max_length=100)
    home_team_id = models.IntegerField(null=True, blank=True)
    away_team_id = models.IntegerField(null=True, blank=True)
    home_team_logo = models.URLField(blank=True, null=True)
    away_team_logo = models.URLField(blank=True, null=True)

    kickoff_time = models.DateTimeField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='scheduled')
    status_short = models.CharField(max_length=10, blank=True, null=True)  # raw API-Football code (FT, NS, 1H...)
    minute = models.IntegerField(null=True, blank=True)

    venue_name = models.CharField(max_length=150, blank=True, null=True)
    venue_city = models.CharField(max_length=100, blank=True, null=True)
    referee = models.CharField(max_length=100, blank=True, null=True)

    home_score = models.IntegerField(null=True, blank=True)
    away_score = models.IntegerField(null=True, blank=True)
    halftime_home_score = models.IntegerField(null=True, blank=True)
    halftime_away_score = models.IntegerField(null=True, blank=True)

    live_stats = models.JSONField(null=True, blank=True)

    winnie_prediction = models.JSONField(null=True, blank=True)
    prediction_fetched_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['kickoff_time']

    def __str__(self):
        return f"{self.home_team} vs {self.away_team} ({self.kickoff_time.date()})"


class MatchRoom(models.Model):
    match = models.OneToOneField(Match, on_delete=models.CASCADE, related_name='room')
    conversation = models.OneToOneField(
        'chat.Conversation', on_delete=models.CASCADE, related_name='match_room'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Room for {self.match}"


class MatchEvent(models.Model):
    EVENT_TYPES = [
        ('goal', 'Goal'),
        ('yellow_card', 'Yellow Card'),
        ('red_card', 'Red Card'),
        ('substitution', 'Substitution'),
        ('var', 'VAR Decision'),
    ]

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    team = models.CharField(max_length=100)
    player = models.CharField(max_length=100, blank=True)
    minute = models.IntegerField()
    detail = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['minute']

    def __str__(self):
        return f"{self.event_type} - {self.player} {self.minute}'"


class PlayerMatchStat(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='player_stats')
    player_id = models.IntegerField()
    player_name = models.CharField(max_length=150)
    team_id = models.IntegerField()
    minutes = models.IntegerField(null=True, blank=True)
    rating = models.CharField(max_length=10, blank=True, null=True)
    position = models.CharField(max_length=20, blank=True, null=True)
    goals = models.IntegerField(default=0)
    assists = models.IntegerField(default=0)
    yellow_cards = models.IntegerField(default=0)
    red_cards = models.IntegerField(default=0)
    full_stats = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('match', 'player_id')
        ordering = ['-match__kickoff_time']

    def __str__(self):
        return f"{self.player_name} - {self.match}"


def validate_match_id(match_id):
    """
    Shared validation used by both chat (REST + WebSocket) and feed
    when creating a match_card/match_object referencing a Match.
    Returns True if match_id is valid or None (no match attached), False otherwise.
    """
    if match_id is None:
        return True
    return Match.objects.filter(id=match_id).exists()