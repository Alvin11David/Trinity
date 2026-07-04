from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from matches.api_football_client import api_football_client
from .models import LeagueStanding
from .serializers import LeagueStandingSerializer


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
        league_id = self.request.query_params.get('league_id')
        season = self.request.query_params.get('season')
        queryset = LeagueStanding.objects.all()
        if league_id:
            queryset = queryset.filter(league_id=league_id)
        if season:
            queryset = queryset.filter(season=season)
        return queryset
