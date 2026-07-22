from django.db import models


class Player(models.Model):
    POSITION_CHOICES = [
        ('Goalkeeper', 'Goalkeeper'),
        ('Defender', 'Defender'),
        ('Midfielder', 'Midfielder'),
        ('Attacker', 'Attacker'),
    ]

    api_football_id = models.IntegerField(unique=True)
    # Team FK (Phase 5): replaced the denormalized team_id/team_name. `team_id`
    # still works as this FK's attname, so existing id reads/filters are unchanged.
    team = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
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

    # --- Transfermarkt enrichment (via Apify; see ball/TRANSFERMARKT.md) ---
    # Populated by the reconcile step matching TM name+dateOfBirth within a squad.
    # The actor resolves foot/agent to readable strings, so no lookup tables.
    transfermarkt_id = models.IntegerField(unique=True, null=True, blank=True)
    market_value_eur = models.BigIntegerField(null=True, blank=True)
    previous_value_eur = models.BigIntegerField(null=True, blank=True)
    contract_until = models.DateField(null=True, blank=True)
    preferred_foot = models.CharField(max_length=10, blank=True, null=True)  # "left"/"right"/"both"
    agent = models.CharField(max_length=150, blank=True, null=True)  # consultantAgencyName
    match_confidence = models.FloatField(null=True, blank=True)
    tm_synced_at = models.DateTimeField(null=True, blank=True)
    tm_raw = models.JSONField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['team', 'position', 'number']

    def __str__(self):
        return f"{self.name} ({self.team.name if self.team_id else ''})"


class PlayerMarketValue(models.Model):
    """One Transfermarkt market-value snapshot — the value-over-time series behind
    a player's MV chart. From the player payload's marketValueHistory[]."""
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='market_value_history')
    date = models.DateField()  # from `determined`
    value_eur = models.BigIntegerField()
    tm_club_id = models.IntegerField(null=True, blank=True)  # TM club id at the time (no name)
    age = models.IntegerField(null=True, blank=True)
    season_id = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('player', 'date')
        ordering = ['player', 'date']

    def __str__(self):
        return f"{self.player.name} · {self.date} · €{self.value_eur:,}"


class PlayerTransfer(models.Model):
    """One career transfer from Transfermarkt (transferHistory[]). Club refs are TM
    ids only — resolve to Team.name via Team.transfermarkt_id where possible."""
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='transfers')
    tm_transfer_id = models.IntegerField(unique=True, null=True, blank=True)
    date = models.DateField(null=True, blank=True)
    from_tm_club_id = models.IntegerField(null=True, blank=True)
    to_tm_club_id = models.IntegerField(null=True, blank=True)
    fee_eur = models.BigIntegerField(null=True, blank=True)  # fee.value; 0 = free, null = unknown
    market_value_eur = models.BigIntegerField(null=True, blank=True)  # MV at transfer time
    transfer_type = models.CharField(max_length=30, blank=True, null=True)  # `type`, e.g. STANDARD
    season_id = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['player', '-date']

    def __str__(self):
        return f"{self.player.name} · {self.date} · €{self.fee_eur or 0:,}"


class Country(models.Model):
    """
    Lookup table synced from API-Football's /countries endpoint — used to
    resolve a flag image for any Player.nationality. Reusing League's
    country_flag data only covers countries we've synced leagues for (~62%
    of real player nationalities); this covers all countries regardless.
    """
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=10, blank=True, null=True)
    flag = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.name
