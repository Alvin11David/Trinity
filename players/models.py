from django.db import models


class Player(models.Model):
    POSITION_CHOICES = [
        ('Goalkeeper', 'Goalkeeper'),
        ('Defender', 'Defender'),
        ('Midfielder', 'Midfielder'),
        ('Attacker', 'Attacker'),
    ]

    api_football_id = models.IntegerField(unique=True)
    team_id = models.IntegerField()
    team_name = models.CharField(max_length=100)
    name = models.CharField(max_length=150)
    first_name = models.CharField(max_length=100, blank=True, null=True)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    age = models.IntegerField(null=True, blank=True)
    number = models.IntegerField(null=True, blank=True)
    position = models.CharField(max_length=20, choices=POSITION_CHOICES, blank=True, null=True)
    photo = models.URLField(blank=True, null=True)

    nationality = models.CharField(max_length=100, blank=True, null=True)
    birth_date = models.CharField(max_length=20, blank=True, null=True)
    birth_place = models.CharField(max_length=100, blank=True, null=True)
    height = models.CharField(max_length=20, blank=True, null=True)
    weight = models.CharField(max_length=20, blank=True, null=True)
    injured = models.BooleanField(default=False)

    # Full statistics array from API-Football, one entry per competition
    statistics = models.JSONField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['team_id', 'position', 'number']

    def __str__(self):
        return f"{self.name} ({self.team_name})"
