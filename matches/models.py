from django.db import models


class Match(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('live', 'Live'),
        ('finished', 'Finished'),
        ('postponed', 'Postponed'),
    ]

    LEAGUE_CHOICES = [
        ('EPL', 'English Premier League'),
        ('LA_LIGA', 'La Liga'),
        ('SERIE_A', 'Serie A'),
        ('BUNDESLIGA', 'Bundesliga'),
        ('LIGUE_1', 'Ligue 1'),
    ]

    api_football_id = models.IntegerField(unique=True)
    league = models.CharField(max_length=20, choices=LEAGUE_CHOICES)
    home_team = models.CharField(max_length=100)
    away_team = models.CharField(max_length=100)
    home_team_logo = models.URLField(blank=True, null=True)
    away_team_logo = models.URLField(blank=True, null=True)
    kickoff_time = models.DateTimeField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='scheduled')
    minute = models.IntegerField(null=True, blank=True)

    # Scores
    home_score = models.IntegerField(null=True, blank=True)
    away_score = models.IntegerField(null=True, blank=True)

    # Live stats
    live_stats = models.JSONField(null=True, blank=True)

    # Winnie prediction (cached from Winnie API)
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