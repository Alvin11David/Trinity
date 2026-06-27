from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Match, MatchRoom, MatchEvent
from .serializers import MatchSerializer, MatchRoomSerializer
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