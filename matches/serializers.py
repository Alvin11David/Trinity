from rest_framework import serializers
from .models import Match, MatchRoom, MatchEvent, LeagueStanding


class MatchEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchEvent
        fields = ['id', 'event_type', 'team', 'player', 'minute', 'detail', 'created_at']


class MatchSerializer(serializers.ModelSerializer):
    events = MatchEventSerializer(many=True, read_only=True)
    has_room = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            'id', 'api_football_id', 'league', 'home_team', 'away_team',
            'home_team_logo', 'away_team_logo', 'kickoff_time', 'status',
            'minute', 'home_score', 'away_score', 'live_stats',
            'winnie_prediction', 'events', 'has_room', 'updated_at'
        ]

    def get_has_room(self, obj):
        return hasattr(obj, 'room')


class MatchRoomSerializer(serializers.ModelSerializer):
    match = MatchSerializer(read_only=True)

    class Meta:
        model = MatchRoom
        fields = ['id', 'match', 'conversation', 'created_at']

class MatchCardSerializer(serializers.ModelSerializer):
    """
    Lightweight serializer for match cards shared in chat/feed.
    Optimized for frequent, lightweight fetches — not the full match detail.
    """
    has_prediction = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            'id', 'league', 'home_team', 'away_team',
            'home_team_logo', 'away_team_logo', 'kickoff_time',
            'status', 'minute', 'home_score', 'away_score',
            'has_prediction', 'updated_at'
        ]

    def get_has_prediction(self, obj):
        return bool(obj.winnie_prediction)


class LeagueStandingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LeagueStanding
        fields = [
            'id', 'league_id', 'league_name', 'season', 'team_id',
            'team_name', 'team_logo', 'rank', 'points', 'goals_diff',
            'form', 'description', 'played', 'win', 'draw', 'lose',
            'goals_for', 'goals_against', 'updated_at'
        ]