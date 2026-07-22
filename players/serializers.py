from rest_framework import serializers
from .models import Player, Country, PlayerMarketValue, PlayerTransfer


class PlayerSerializer(serializers.ModelSerializer):
    # Phase 4: team_name via the Team FK (denormalized column drops in Phase 5).
    team_name = serializers.CharField(source='team.name', read_only=True, allow_null=True)

    class Meta:
        model = Player
        fields = [
            'id', 'api_football_id', 'team_id', 'team_name', 'name',
            'first_name', 'last_name', 'age', 'number', 'position', 'photo',
            'nationality', 'birth_date', 'birth_place', 'height', 'weight',
            'injured', 'statistics', 'updated_at',
            # Transfermarkt enrichment (null until the TM sync matches this player).
            'transfermarkt_id', 'market_value_eur', 'previous_value_eur',
            'contract_until', 'preferred_foot', 'agent', 'tm_synced_at',
        ]


class PlayerMarketValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerMarketValue
        fields = ['date', 'value_eur', 'tm_club_id', 'age', 'season_id']


class PlayerTransferSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerTransfer
        fields = [
            'date', 'from_tm_club_id', 'to_tm_club_id', 'fee_eur',
            'market_value_eur', 'transfer_type', 'season_id',
        ]


class PlayerSearchSerializer(serializers.ModelSerializer):
    """Lean payload for the Leagues-tab entity search — omits the heavy
    `statistics` JSON blob PlayerSerializer carries, which a results list
    never needs."""
    team_name = serializers.CharField(source='team.name', read_only=True, allow_null=True)

    class Meta:
        model = Player
        fields = [
            'api_football_id', 'name', 'team_id', 'team_name',
            'position', 'photo', 'nationality',
        ]


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = ['id', 'name', 'code', 'flag']
