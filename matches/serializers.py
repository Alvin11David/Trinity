from rest_framework import serializers
from .models import Match, MatchRoom, MatchEvent, PlayerMatchStat, MatchOdds, MatchLineup


class MatchEventSerializer(serializers.ModelSerializer):
    # Phase 4: `team` name now read through the Team FK (was a denormalized
    # column dropped in Phase 5). Output is identical for all rows (verified).
    team = serializers.CharField(source='team.name', read_only=True, allow_null=True)

    class Meta:
        model = MatchEvent
        fields = ['id', 'event_type', 'team', 'player', 'minute', 'detail', 'assist_player', 'created_at']


class MatchSerializer(serializers.ModelSerializer):
    events = MatchEventSerializer(many=True, read_only=True)
    has_room = serializers.SerializerMethodField()
    # Phase 4: team name/logo read through the Team FK (denormalized columns drop
    # in Phase 5). The integer home_team_id/away_team_id stay as-is — they survive
    # the Phase 5 FK rename as the FK's own *_id attribute.
    home_team = serializers.CharField(source='home_team.name', read_only=True, allow_null=True)
    away_team = serializers.CharField(source='away_team.name', read_only=True, allow_null=True)
    home_team_logo = serializers.CharField(source='home_team.logo', read_only=True, allow_null=True)
    away_team_logo = serializers.CharField(source='away_team.logo', read_only=True, allow_null=True)

    class Meta:
        model = Match
        fields = [
            'id', 'api_football_id', 'league', 'league_id', 'league_name',
            'round', 'season', 'home_team', 'away_team', 'home_team_id',
            'away_team_id', 'home_team_logo', 'away_team_logo', 'kickoff_time',
            'status', 'status_short', 'minute', 'venue_name', 'venue_city',
            'referee', 'home_score', 'away_score', 'halftime_home_score',
            'halftime_away_score', 'live_stats', 'winnie_prediction', 'events',
            'has_room', 'updated_at'
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
    # Phase 4: team name/logo via the Team FK (see MatchSerializer).
    home_team = serializers.CharField(source='home_team.name', read_only=True, allow_null=True)
    away_team = serializers.CharField(source='away_team.name', read_only=True, allow_null=True)
    home_team_logo = serializers.CharField(source='home_team.logo', read_only=True, allow_null=True)
    away_team_logo = serializers.CharField(source='away_team.logo', read_only=True, allow_null=True)

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


class PlayerMatchStatSerializer(serializers.ModelSerializer):
    match_summary = serializers.SerializerMethodField()

    class Meta:
        model = PlayerMatchStat
        fields = [
            'id', 'match', 'match_summary', 'player_id', 'player_name', 'team_id',
            'minutes', 'rating', 'position', 'goals', 'assists',
            'yellow_cards', 'red_cards', 'full_stats', 'created_at'
        ]

    def get_match_summary(self, obj):
        match = obj.match
        home, away = match.home_team, match.away_team
        return {
            'kickoff_time': match.kickoff_time,
            'league_name': match.league_name,
            'home_team': home.name if home else None,
            'away_team': away.name if away else None,
            'home_team_id': match.home_team_id,
            'away_team_id': match.away_team_id,
            'home_team_logo': home.logo if home else None,
            'away_team_logo': away.logo if away else None,
            'home_score': match.home_score,
            'away_score': match.away_score,
        }


class MatchOddsSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchOdds
        fields = ['id', 'match', 'bookmaker_name', 'data', 'updated_at']


class MatchLineupSerializer(serializers.ModelSerializer):
    class Meta:
        model = MatchLineup
        fields = ['id', 'match', 'data', 'updated_at']