from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Match, MatchRoom, MatchEvent
from .serializers import MatchSerializer, MatchRoomSerializer, MatchCardSerializer, LeagueStandingSerializer
from .winnie_client import winnie_client
from chat.models import Conversation, Membership

class MatchListView(generics.ListAPIView):
    serializer_class = MatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Match.objects.all().prefetch_related('events')
        league = self.request.query_params.get('league')
        status_filter = self.request.query_params.get('status')
        if league:
            queryset = queryset.filter(league=league)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset


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
        league = self.kwargs['league']
        return Match.objects.filter(
            league=league
        ).prefetch_related('events')
    
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


class SyncStandingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        league_id = request.data.get('league_id')
        season = request.data.get('season')

        if not league_id or not season:
            return Response(
                {'error': 'league_id and season are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .api_football_client import api_football_client
        from .models import LeagueStanding

        data = api_football_client.get_standings(league_id=league_id, season=season)

        if not data:
            return Response(
                {'error': 'Could not fetch standings from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        updated_count = 0
        for league_entry in data:
            league_info = league_entry['league']
            league_name = league_info['name']
            standings_table = league_info['standings'][0]

            for team_entry in standings_table:
                LeagueStanding.objects.update_or_create(
                    league_id=league_id,
                    season=season,
                    team_id=team_entry['team']['id'],
                    defaults={
                        'league_name': league_name,
                        'team_name': team_entry['team']['name'],
                        'team_logo': team_entry['team']['logo'],
                        'rank': team_entry['rank'],
                        'points': team_entry['points'],
                        'goals_diff': team_entry['goalsDiff'],
                        'form': team_entry.get('form', ''),
                        'description': team_entry.get('description'),
                        'played': team_entry['all']['played'],
                        'win': team_entry['all']['win'],
                        'draw': team_entry['all']['draw'],
                        'lose': team_entry['all']['lose'],
                        'goals_for': team_entry['all']['goals']['for'],
                        'goals_against': team_entry['all']['goals']['against'],
                    }
                )
                updated_count += 1

        return Response({'status': 'synced', 'updated_count': updated_count})


class LeagueStandingsView(generics.ListAPIView):
    serializer_class = LeagueStandingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import LeagueStanding
        league_id = self.request.query_params.get('league_id')
        season = self.request.query_params.get('season')
        queryset = LeagueStanding.objects.all()
        if league_id:
            queryset = queryset.filter(league_id=league_id)
        if season:
            queryset = queryset.filter(season=season)
        return queryset