from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from matches.api_football_client import api_football_client
from .models import LeagueStanding, League, UserLeagueFollow
from .serializers import (
    LeagueStandingSerializer, PlayerLeagueStatSerializer,
    TeamStatisticsSerializer, LeagueSerializer
)


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


class SyncPlayerStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        league_id = request.data.get('league_id')
        season = request.data.get('season')

        if not league_id or not season:
            return Response(
                {'error': 'league_id and season are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from matches.api_football_client import api_football_client
        from .models import PlayerLeagueStat

        updated_count = 0

        for rank_type, fetch_fn in [
            ('scorer', api_football_client.get_top_scorers),
            ('assist', api_football_client.get_top_assists),
        ]:
            data = fetch_fn(league_id=league_id, season=season)
            if not data:
                continue

            for position, entry in enumerate(data, start=1):
                player_info = entry['player']
                stat = entry['statistics'][0] if entry.get('statistics') else {}
                team_info = stat.get('team', {})
                games_info = stat.get('games', {})
                goals_info = stat.get('goals', {})

                PlayerLeagueStat.objects.update_or_create(
                    league_id=league_id,
                    season=season,
                    player_id=player_info['id'],
                    rank_type=rank_type,
                    defaults={
                        'player_name': player_info['name'],
                        'player_photo': player_info.get('photo'),
                        'team_id': team_info.get('id'),
                        'team_name': team_info.get('name', ''),
                        'team_logo': team_info.get('logo'),
                        'goals': goals_info.get('total') or 0,
                        'assists': goals_info.get('assists') or 0,
                        'appearances': games_info.get('appearences') or 0,
                        'rank_position': position,
                    }
                )
                updated_count += 1

        return Response({'status': 'synced', 'updated_count': updated_count})


class PlayerLeagueStatsView(generics.ListAPIView):
    serializer_class = PlayerLeagueStatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import PlayerLeagueStat
        league_id = self.request.query_params.get('league_id')
        season = self.request.query_params.get('season')
        rank_type = self.request.query_params.get('rank_type', 'scorer')
        queryset = PlayerLeagueStat.objects.filter(rank_type=rank_type)
        if league_id:
            queryset = queryset.filter(league_id=league_id)
        if season:
            queryset = queryset.filter(season=season)
        return queryset


class SyncTeamStatisticsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        league_id = request.data.get('league_id')
        team_id = request.data.get('team_id')
        season = request.data.get('season')

        if not league_id or not team_id or not season:
            return Response(
                {'error': 'league_id, team_id, and season are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from matches.api_football_client import api_football_client
        from .models import TeamStatistics

        data = api_football_client.get_team_statistics(league_id=league_id, team_id=team_id, season=season)

        if not data:
            return Response(
                {'error': 'Could not fetch team statistics from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        team_info = data.get('team', {})

        TeamStatistics.objects.update_or_create(
            league_id=league_id,
            team_id=team_id,
            season=season,
            defaults={
                'team_name': team_info.get('name', ''),
                'team_logo': team_info.get('logo'),
                'form': data.get('form', ''),
                'data': data,
            }
        )

        return Response({'status': 'synced'})


class TeamStatisticsView(generics.RetrieveAPIView):
    serializer_class = TeamStatisticsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        from .models import TeamStatistics
        from django.shortcuts import get_object_or_404
        league_id = self.request.query_params.get('league_id')
        team_id = self.request.query_params.get('team_id')
        season = self.request.query_params.get('season')
        return get_object_or_404(TeamStatistics, league_id=league_id, team_id=team_id, season=season)


CORE_LEAGUE_IDS = {39, 140, 135, 78, 61}  # EPL, La Liga, Serie A, Bundesliga, Ligue 1


class SyncLeaguesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        country = request.data.get('country')

        from matches.api_football_client import api_football_client
        from .models import League

        data = api_football_client.get_leagues(country=country)

        if not data:
            return Response(
                {'error': 'Could not fetch leagues from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        updated_count = 0
        for entry in data:
            league_info = entry['league']
            country_info = entry.get('country', {})
            seasons = entry.get('seasons', [])
            current_season = next((s['year'] for s in seasons if s.get('current')), None)

            League.objects.update_or_create(
                league_id=league_info['id'],
                defaults={
                    'name': league_info['name'],
                    'league_type': league_info.get('type'),
                    'logo': league_info.get('logo'),
                    'country_name': country_info.get('name'),
                    'country_code': country_info.get('code'),
                    'country_flag': country_info.get('flag'),
                    'current_season': current_season,
                    'is_core_league': league_info['id'] in CORE_LEAGUE_IDS,
                }
            )
            updated_count += 1

        return Response({'status': 'synced', 'updated_count': updated_count})


class LeagueListView(generics.ListAPIView):
    serializer_class = LeagueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import League
        queryset = League.objects.all()
        search = self.request.query_params.get('search')
        country = self.request.query_params.get('country')
        core_only = self.request.query_params.get('core_only')
        if search:
            queryset = queryset.filter(name__icontains=search)
        if country:
            queryset = queryset.filter(country_name__iexact=country)
        if core_only == 'true':
            queryset = queryset.filter(is_core_league=True)
        return queryset


class FollowLeagueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, league_id):
        league = get_object_or_404(League, league_id=league_id)
        follow, created = UserLeagueFollow.objects.get_or_create(user=request.user, league=league)
        if not created:
            follow.delete()
            return Response({'status': 'unfollowed'})
        return Response({'status': 'followed'})


class FollowedLeaguesView(generics.ListAPIView):
    serializer_class = LeagueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return League.objects.filter(followers__user=self.request.user).order_by('followers__order')

    def get_serializer_context(self):
        return {'request': self.request}
