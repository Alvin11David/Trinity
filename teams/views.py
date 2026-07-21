from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from matches.api_football_client import api_football_client
from .models import Team
from .serializers import TeamSerializer


class SyncTeamsView(APIView):
    """
    Authoritative Team ingest from API-Football /teams?league=&season=.
    Populates identity + venue; leaves the Transfermarkt columns untouched
    (those are filled later by the Apify pipeline once matched).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        league_id = request.data.get('league_id')
        season = request.data.get('season')

        if not league_id or not season:
            return Response(
                {'error': 'league_id and season are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = api_football_client.get_teams(league_id=league_id, season=season)
        if not data:
            return Response(
                {'error': 'Could not fetch teams from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        updated_count = 0
        for entry in data:
            self._upsert_team(entry)
            updated_count += 1

        return Response({'status': 'synced', 'updated_count': updated_count})

    def _upsert_team(self, entry):
        team = entry.get('team', {})
        venue = entry.get('venue') or {}
        team_id = team.get('id')
        if not team_id:
            return

        Team.objects.update_or_create(
            pk=team_id,
            defaults={
                'name': team.get('name', ''),
                'code': team.get('code'),
                'country': team.get('country'),
                'founded': team.get('founded'),
                'national': team.get('national', False),
                'logo': team.get('logo'),
                'venue_name': venue.get('name'),
                'venue_city': venue.get('city'),
                'venue_capacity': venue.get('capacity'),
            },
        )


class TeamListView(generics.ListAPIView):
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Team.objects.all()


class TeamDetailView(generics.RetrieveAPIView):
    serializer_class = TeamSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Team.objects.all()
    lookup_field = 'pk'  # API-Football numeric team id
