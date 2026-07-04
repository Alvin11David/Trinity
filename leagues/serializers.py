from rest_framework import serializers
from .models import LeagueStanding, PlayerLeagueStat


class LeagueStandingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeagueStanding
        fields = [
            'id', 'league_id', 'league_name', 'season', 'team_id',
            'team_name', 'team_logo', 'rank', 'points', 'goals_diff',
            'form', 'description', 'played', 'win', 'draw', 'lose',
            'goals_for', 'goals_against', 'updated_at'
        ]


class PlayerLeagueStatSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlayerLeagueStat
        fields = [
            'id', 'league_id', 'season', 'player_id', 'player_name',
            'player_photo', 'team_id', 'team_name', 'team_logo',
            'goals', 'assists', 'appearances', 'rank_type',
            'rank_position', 'updated_at'
        ]
