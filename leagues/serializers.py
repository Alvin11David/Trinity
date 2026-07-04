from rest_framework import serializers
from .models import LeagueStanding


class LeagueStandingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeagueStanding
        fields = [
            'id', 'league_id', 'league_name', 'season', 'team_id',
            'team_name', 'team_logo', 'rank', 'points', 'goals_diff',
            'form', 'description', 'played', 'win', 'draw', 'lose',
            'goals_for', 'goals_against', 'updated_at'
        ]
