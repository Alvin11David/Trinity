from rest_framework import serializers
from .models import LeagueStanding, PlayerLeagueStat, TeamStatistics, League


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


class TeamStatisticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeamStatistics
        fields = ['id', 'league_id', 'team_id', 'season', 'team_name', 'team_logo', 'form', 'data', 'updated_at']


class LeagueSerializer(serializers.ModelSerializer):
    class Meta:
        model = League
        fields = [
            'id', 'league_id', 'name', 'league_type', 'logo',
            'country_name', 'country_code', 'country_flag',
            'current_season', 'is_core_league', 'updated_at'
        ]
