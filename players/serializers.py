from rest_framework import serializers
from .models import Player, Country


class PlayerSerializer(serializers.ModelSerializer):
    # Phase 4: team_name via the Team FK (denormalized column drops in Phase 5).
    team_name = serializers.CharField(source='team_ref.name', read_only=True, allow_null=True)

    class Meta:
        model = Player
        fields = [
            'id', 'api_football_id', 'team_id', 'team_name', 'name',
            'first_name', 'last_name', 'age', 'number', 'position', 'photo',
            'nationality', 'birth_date', 'birth_place', 'height', 'weight',
            'injured', 'statistics', 'updated_at'
        ]


class PlayerSearchSerializer(serializers.ModelSerializer):
    """Lean payload for the Leagues-tab entity search — omits the heavy
    `statistics` JSON blob PlayerSerializer carries, which a results list
    never needs."""
    team_name = serializers.CharField(source='team_ref.name', read_only=True, allow_null=True)

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
