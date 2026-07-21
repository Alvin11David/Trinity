from rest_framework import serializers
from .models import Player, Country


class PlayerSerializer(serializers.ModelSerializer):
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
