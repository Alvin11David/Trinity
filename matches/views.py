from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone
import requests
from .models import Match, MatchRoom, MatchEvent
from .serializers import MatchSerializer, MatchRoomSerializer
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
        if not match.winnie_prediction or not match.prediction_fetched_at or \
                (timezone.now() - match.prediction_fetched_at).seconds > 3600:
            try:
                response = requests.get(
                    f'http://localhost:8000/api/predictions/{match.api_football_id}/',
                    timeout=5
                )
                if response.status_code == 200:
                    match.winnie_prediction = response.json()
                    match.prediction_fetched_at = timezone.now()
                    match.save()
            except requests.RequestException:
                pass
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