from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Match, MatchRoom, MatchEvent, PlayerMatchStat, MatchOdds, MatchLineup
from .serializers import MatchSerializer, MatchRoomSerializer, MatchCardSerializer, PlayerMatchStatSerializer, MatchOddsSerializer, MatchLineupSerializer
from .winnie_client import winnie_client
from chat.models import Conversation, Membership

class MatchListView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Match.objects.all().prefetch_related('events')
        league_id = self.request.query_params.get('league_id')
        status_filter = self.request.query_params.get('status')
        date = self.request.query_params.get('date')  # YYYY-MM-DD
        season = self.request.query_params.get('season')
        if league_id:
            queryset = queryset.filter(league_id=league_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if date:
            queryset = queryset.filter(kickoff_time__date=date)
        if season:
            queryset = queryset.filter(season=season)
        return queryset.order_by('kickoff_time')


class MatchDetailView(generics.RetrieveAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Match.objects.all().prefetch_related('events')

    def retrieve(self, request, *args, **kwargs):
        match = self.get_object()
        # Fetch fresh Winnie prediction if older than 1 hour
        stale = (
            not match.winnie_prediction
            or not match.prediction_fetched_at
            or (timezone.now() - match.prediction_fetched_at).seconds > 3600
        )
        if stale:
            prediction = winnie_client.get_prediction_for_match(match.api_football_id)
            if prediction:
                match.winnie_prediction = prediction
                match.prediction_fetched_at = timezone.now()
                match.save()
        serializer = self.get_serializer(match)
        return Response(serializer.data)
    
class LiveMatchesView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Match.objects.filter(status='live').prefetch_related('events')


class MatchRoomView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        match = get_object_or_404(Match, pk=pk)
        if not hasattr(match, 'room'):
            # Create match room automatically
            conversation = Conversation.objects.create(
                conversation_type='channel',
                channel_mode='open',
                name=f"{match.home_team} vs {match.away_team}",
                is_public=True
            )
            Membership.objects.create(
                user=request.user,
                conversation=conversation,
                role='member'
            )
            room = MatchRoom.objects.create(match=match, conversation=conversation)
        else:
            room = match.room
            # Auto join if not a member
            Membership.objects.get_or_create(
                user=request.user,
                conversation=room.conversation,
                defaults={'role': 'member'}
            )
        serializer = MatchRoomSerializer(room)
        return Response(serializer.data)


class UpcomingMatchesView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Match.objects.filter(
            status='scheduled',
            kickoff_time__gte=timezone.now()
        ).prefetch_related('events')


class LeagueMatchesView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        league_id = self.kwargs['league_id']
        return Match.objects.filter(
            league_id=league_id
        ).prefetch_related('events')


class TeamMatchesView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        team_id = self.kwargs['team_id']
        from django.db.models import Q
        return Match.objects.filter(Q(home_team_id=team_id) | Q(away_team_id=team_id)).order_by('kickoff_time')


class TeamProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, team_id):
        from .api_football_client import api_football_client
        data = api_football_client.get_team(team_id=team_id)
        if not data:
            return Response({'error': 'Team not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(data[0])


class PlayerMatchHistoryView(generics.ListAPIView):
    serializer_class = PlayerMatchStatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        player_id = self.kwargs['player_id']
        return PlayerMatchStat.objects.filter(
            player_id=player_id
        ).select_related('match').order_by('-match__kickoff_time')


class SyncPredictionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        league = request.data.get('league')
        predictions = winnie_client.get_predictions(league=league)

        if predictions is None:
            return Response(
                {'error': 'Could not reach Winnie API.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        updated_count = 0
        results = predictions if isinstance(predictions, list) else predictions.get('results', [])

        for item in results:
            match_id = item.get('match_id') or item.get('id')
            if not match_id:
                continue
            match = Match.objects.filter(api_football_id=match_id).first()
            if match:
                match.winnie_prediction = item
                match.prediction_fetched_at = timezone.now()
                match.save()
                updated_count += 1

        return Response({
            'status': 'synced',
            'updated_count': updated_count,
            'total_received': len(results)
        })
    
class MatchCardBatchView(APIView):
    """
    Batch-fetch lightweight card data for multiple matches at once.
    Used when rendering a chat/feed screen with several match cards.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        match_ids = request.data.get('match_ids', [])
        if not isinstance(match_ids, list) or not match_ids:
            return Response({'error': 'match_ids must be a non-empty list.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(match_ids) > 50:
            return Response({'error': 'Maximum 50 match_ids per request.'}, status=status.HTTP_400_BAD_REQUEST)

        matches = Match.objects.filter(id__in=match_ids)
        serializer = MatchCardSerializer(matches, many=True)
        return Response(serializer.data)


class MatchOddsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id):
        odds = MatchOdds.objects.filter(match_id=match_id).first()
        if not odds:
            return Response(
                {'detail': 'Odds not yet available for this match.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = MatchOddsSerializer(odds)
        return Response(serializer.data)


class MatchLineupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id):
        lineup = MatchLineup.objects.filter(match_id=match_id).first()
        if not lineup:
            return Response(
                {'detail': 'Lineup not yet available for this match.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = MatchLineupSerializer(lineup)
        return Response(serializer.data)


def _team_result(match, team_id):
    """W/D/L for team_id in a finished match, or None if team_id wasn't in it."""
    if match.home_score is None or match.away_score is None:
        return None
    if match.home_team_id == team_id:
        if match.home_score > match.away_score:
            return 'W'
        if match.home_score < match.away_score:
            return 'L'
        return 'D'
    if match.away_team_id == team_id:
        if match.away_score > match.home_score:
            return 'W'
        if match.away_score < match.home_score:
            return 'L'
        return 'D'
    return None


class MatchH2HView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id):
        from django.db.models import Q

        match = get_object_or_404(Match, pk=match_id)
        team1_id, team2_id = match.home_team_id, match.away_team_id

        if not team1_id or not team2_id:
            return Response({'detail': 'Match is missing team IDs.'}, status=status.HTTP_400_BAD_REQUEST)

        meetings = Match.objects.filter(
            Q(home_team_id=team1_id, away_team_id=team2_id) | Q(home_team_id=team2_id, away_team_id=team1_id),
            status='finished'
        ).exclude(pk=match.pk).order_by('-kickoff_time')[:10]

        team1_wins = draws = team2_wins = 0
        for m in meetings:
            result = _team_result(m, team1_id)
            if result == 'W':
                team1_wins += 1
            elif result == 'L':
                team2_wins += 1
            elif result == 'D':
                draws += 1

        serializer = MatchSerializer(meetings, many=True)
        return Response({
            'summary': {
                'team1_id': team1_id,
                'team2_id': team2_id,
                'team1_wins': team1_wins,
                'draws': draws,
                'team2_wins': team2_wins,
            },
            'matches': serializer.data,
        })


class MatchPreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, match_id):
        match = get_object_or_404(Match, pk=match_id)

        def recent_form(team_id):
            from django.db.models import Q
            if not team_id:
                return []
            recent = Match.objects.filter(
                Q(home_team_id=team_id) | Q(away_team_id=team_id),
                status='finished'
            ).exclude(pk=match.pk).order_by('-kickoff_time')[:5]
            return [
                {
                    'match_id': m.id,
                    'result': _team_result(m, team_id),
                    'opponent': m.away_team if m.home_team_id == team_id else m.home_team,
                    'home_score': m.home_score,
                    'away_score': m.away_score,
                    'kickoff_time': m.kickoff_time,
                }
                for m in recent
            ]

        return Response({
            'venue_name': match.venue_name,
            'venue_city': match.venue_city,
            'referee': match.referee,
            'home_team_form': recent_form(match.home_team_id),
            'away_team_form': recent_form(match.away_team_id),
        })


class SyncFixturesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    STATUS_MAP = {
        'NS': 'scheduled',
        'TBD': 'scheduled',
        '1H': 'live', 'HT': 'live', '2H': 'live', 'ET': 'live', 'P': 'live', 'BT': 'live',
        'FT': 'finished', 'AET': 'finished', 'PEN': 'finished',
        'PST': 'postponed', 'CANC': 'postponed', 'ABD': 'postponed', 'SUSP': 'postponed', 'INT': 'postponed',
    }

    def post(self, request):
        league_id = request.data.get('league_id')
        season = request.data.get('season')

        if not league_id or not season:
            return Response(
                {'error': 'league_id and season are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .api_football_client import api_football_client

        data = api_football_client.get_fixtures(league_id=league_id, season=season)

        if not data:
            return Response(
                {'error': 'Could not fetch fixtures from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        updated_count = 0
        for item in data:
            fixture = item['fixture']
            league_info = item['league']
            teams = item['teams']
            goals = item['goals']
            score = item['score']

            status_short = fixture['status']['short']
            mapped_status = self.STATUS_MAP.get(status_short, 'scheduled')

            Match.objects.update_or_create(
                api_football_id=fixture['id'],
                defaults={
                    'league': league_info.get('name', '')[:20],
                    'league_id': league_info.get('id'),
                    'league_name': league_info.get('name'),
                    'round': league_info.get('round'),
                    'season': league_info.get('season'),
                    'home_team': teams['home']['name'],
                    'away_team': teams['away']['name'],
                    'home_team_id': teams['home']['id'],
                    'away_team_id': teams['away']['id'],
                    'home_team_logo': teams['home']['logo'],
                    'away_team_logo': teams['away']['logo'],
                    'kickoff_time': fixture['date'],
                    'status': mapped_status,
                    'status_short': status_short,
                    'minute': fixture['status'].get('elapsed'),
                    'venue_name': fixture['venue'].get('name'),
                    'venue_city': fixture['venue'].get('city'),
                    'referee': fixture.get('referee'),
                    'home_score': goals.get('home'),
                    'away_score': goals.get('away'),
                    'halftime_home_score': score['halftime'].get('home'),
                    'halftime_away_score': score['halftime'].get('away'),
                }
            )
            updated_count += 1

        return Response({'status': 'synced', 'updated_count' : updated_count})