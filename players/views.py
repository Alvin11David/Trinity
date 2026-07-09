from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from matches.api_football_client import api_football_client
from .models import Player, Country
from .serializers import PlayerSerializer, CountrySerializer


class SyncPlayersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        team_id = request.data.get('team_id')
        season = request.data.get('season')

        if not team_id or not season:
            return Response(
                {'error': 'team_id and season are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # get_players returns the full API-Football payload:
        # {'response': [...], 'paging': {'current': 1, 'total': N}}
        first_page = api_football_client.get_players(team_id=team_id, season=season, page=1)

        if not first_page:
            return Response(
                {'error': 'Could not fetch players from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        total_pages = first_page.get('paging', {}).get('total', 1) or 1

        updated_count = 0
        page_data = first_page
        page = 1
        while True:
            for entry in page_data.get('response', []):
                self._upsert_player(entry)
                updated_count += 1

            if page >= total_pages:
                break

            page += 1
            page_data = api_football_client.get_players(team_id=team_id, season=season, page=page)
            if not page_data:
                break

        return Response({
            'status': 'synced',
            'updated_count': updated_count,
            'pages': total_pages
        })

    def _upsert_player(self, entry):
        player = entry.get('player', {})
        stats_list = entry.get('statistics') or []
        stats = stats_list[0] if stats_list else {}
        team = stats.get('team', {})
        games = stats.get('games', {})
        birth = player.get('birth') or {}

        Player.objects.update_or_create(
            api_football_id=player['id'],
            defaults={
                'team_id': team.get('id'),
                'team_name': team.get('name', ''),
                'name': player.get('name', ''),
                'first_name': player.get('firstname'),
                'last_name': player.get('lastname'),
                'age': player.get('age'),
                'number': games.get('number'),
                'position': games.get('position'),
                'photo': player.get('photo'),
                'nationality': player.get('nationality'),
                'birth_date': birth.get('date'),
                'birth_place': birth.get('place'),
                'height': player.get('height'),
                'weight': player.get('weight'),
                'injured': player.get('injured', False),
                'statistics': stats_list,
            }
        )


class TeamSquadView(generics.ListAPIView):
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        team_id = self.request.query_params.get('team_id')
        player_id = self.request.query_params.get('player_id')
        queryset = Player.objects.all()
        if team_id:
            queryset = queryset.filter(team_id=team_id)
        # player_id means the API-Football numeric id everywhere else in this
        # system (PlayerLeagueStat.player_id, PlayerMatchStat.player_id) —
        # match that convention, not the Django PK.
        if player_id:
            queryset = queryset.filter(api_football_id=player_id)
        return queryset


class SyncCountriesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = api_football_client.get_countries()

        if not data:
            return Response(
                {'error': 'Could not fetch countries from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        updated_count = 0
        for entry in data:
            name = entry.get('name')
            if not name:
                continue
            Country.objects.update_or_create(
                name=name,
                defaults={
                    'code': entry.get('code'),
                    'flag': entry.get('flag'),
                }
            )
            updated_count += 1

        return Response({'status': 'synced', 'updated_count': updated_count})


class CountryListView(generics.ListAPIView):
    serializer_class = CountrySerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Country.objects.all()
