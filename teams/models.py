from django.contrib.postgres.indexes import GinIndex
from django.db import models


class Team(models.Model):
    """
    First-class football club/team entity. This app introduces the Team model
    the rest of the codebase historically did without — Match/TeamStatistics/
    LeagueStanding/Player/User all carried denormalized team_id/team_name/logo
    (the "Section 38" convention). Those are being migrated to FK into this
    model; see the phased plan.

    IMPORTANT: the primary key IS the API-Football numeric team id (no surrogate
    AutoField). Every existing `*_team_id` integer column across the app already
    stores exactly these values, so converting those columns to ForeignKey(Team)
    needs no value remap — the raw integers are already valid PK/FK values.

    Fields split into two provenances:
      * API-Football  — identity + venue (authoritative, synced via SyncTeamsView)
      * Transfermarkt — enrichment (market/squad value) API-Football can't give,
                        populated later via the Apify pipeline once a TM record
                        is matched. `transfermarkt_id`/`match_confidence` are the
                        auto-match audit trail.
    """
    # --- API-Football identity (PK = api_football_id) ---
    api_football_id = models.IntegerField(primary_key=True)  # NOT an AutoField
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=10, blank=True, null=True)  # e.g. "MUN"
    country = models.CharField(max_length=100, blank=True, null=True)
    founded = models.IntegerField(null=True, blank=True)
    national = models.BooleanField(default=False)  # national team vs. club
    logo = models.URLField(blank=True, null=True)

    # --- Venue (from API-Football /teams payload) ---
    venue_name = models.CharField(max_length=150, blank=True, null=True)
    venue_city = models.CharField(max_length=100, blank=True, null=True)
    venue_capacity = models.IntegerField(null=True, blank=True)

    # --- Transfermarkt enrichment (populated by the Apify pipeline) ---
    transfermarkt_id = models.IntegerField(unique=True, null=True, blank=True)
    squad_value_eur = models.BigIntegerField(null=True, blank=True)
    transfer_balance_eur = models.BigIntegerField(null=True, blank=True)
    # Confidence of the auto-match that linked this row to its TM record (0..1).
    # Rows below threshold are left unlinked and logged rather than force-matched.
    match_confidence = models.FloatField(null=True, blank=True)
    tm_synced_at = models.DateTimeField(null=True, blank=True)
    tm_raw = models.JSONField(null=True, blank=True)  # full TM payload, unqueried extras

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            # Trigram GIN index for name search — match search (feed) and the
            # favorite-team picker now search Team.name via the FK (Phase 5).
            GinIndex(fields=['name'], name='team_name_trgm', opclasses=['gin_trgm_ops']),
        ]

    def __str__(self):
        return f"{self.name} ({self.api_football_id})"

    @classmethod
    def ensure(cls, team_id, name='', logo=None, country=None):
        """
        Get-or-create used by ingest paths so a Team row always exists before
        anything FKs to it — no ingest should ever fail on an unseen team.

        Deliberately conservative: on an EXISTING row it only refreshes name/logo
        (cheap, safe, and they do drift), and never overwrites richer fields set
        by the authoritative SyncTeamsView or the TM pipeline with sparse ingest
        data. Returns the Team, or None if team_id is falsy.
        """
        if not team_id:
            return None
        team, created = cls.objects.get_or_create(
            pk=team_id,
            defaults={
                'name': name or '',
                'logo': logo,
                'country': country,
            },
        )
        if not created:
            dirty = []
            if name and team.name != name:
                team.name = name
                dirty.append('name')
            if logo and team.logo != logo:
                team.logo = logo
                dirty.append('logo')
            if dirty:
                team.save(update_fields=dirty + ['updated_at'])
        return team
