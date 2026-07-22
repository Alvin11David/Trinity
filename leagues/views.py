from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from .models import LeagueStanding, League, UserLeagueFollow, UserTeamFollow
from .serializers import (
    LeagueStandingSerializer, PlayerLeagueStatSerializer,
    TeamStatisticsSerializer, LeagueSerializer, UserTeamFollowSerializer
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

        from .tasks import sync_standings_for_league

        updated_count = sync_standings_for_league(league_id, season)

        if updated_count is None:
            return Response(
                {'error': 'Could not fetch standings from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

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

        from .tasks import sync_player_stats_for_league

        updated_count = sync_player_stats_for_league(league_id, season)

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
        from teams.models import Team

        data = api_football_client.get_team_statistics(league_id=league_id, team_id=team_id, season=season)

        if not data:
            return Response(
                {'error': 'Could not fetch team statistics from API-Football.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        team_info = data.get('team', {})

        TeamStatistics.objects.update_or_create(
            league_id=league_id,
            team=Team.ensure(team_id, team_info.get('name'), team_info.get('logo')),
            season=season,
            defaults={
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


class TeamStatsLeaderboardView(generics.ListAPIView):
    serializer_class = TeamStatisticsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        from .models import TeamStatistics
        league_id = self.request.query_params.get('league_id')
        season = self.request.query_params.get('season')
        return TeamStatistics.objects.filter(league_id=league_id, season=season)


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
        featured_only = self.request.query_params.get('featured_only')
        if search:
            queryset = queryset.filter(name__icontains=search)
        if country:
            queryset = queryset.filter(country_name__iexact=country)
        if core_only == 'true':
            queryset = queryset.filter(is_core_league=True)
        if featured_only == 'true':
            queryset = queryset.filter(is_featured=True)
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


class TeamSearchView(APIView):
    """(team_id, team_name, team_logo) search for the favorite-team picker.
    Now backed by the real Team model (Phase 5), so it covers every synced team
    (not just those in standings) and needs no dedup — Team is unique per id.
    Output keys are unchanged (team_id/team_name/team_logo). Plain icontains —
    a few thousand teams, no FTS/pg_trgm needed here."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from teams.models import Team
        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response([])
        try:
            limit = min(int(request.query_params.get('limit', 30)), 50)
        except (TypeError, ValueError):
            limit = 30

        rows = Team.objects.filter(name__icontains=q).order_by('name')[:limit]
        out = [{'team_id': t.pk, 'team_name': t.name, 'team_logo': t.logo} for t in rows]
        return Response(out)


class FollowTeamView(APIView):
    """Toggle following a team (CLAUDE.md Step 8 prerequisite). Denormalized:
    the client passes team_name/team_logo (no Team model to look them up from).
    On follow it stores/refreshes them; the toggle keys on team_id."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, team_id):
        existing = UserTeamFollow.objects.filter(user=request.user, team_id=team_id).first()
        if existing:
            existing.delete()
            return Response({'status': 'unfollowed'})
        from teams.models import Team
        UserTeamFollow.objects.create(
            user=request.user,
            team=Team.ensure(team_id, request.data.get('team_name'), request.data.get('team_logo')),
        )
        return Response({'status': 'followed'})


class FollowedTeamsView(generics.ListAPIView):
    serializer_class = UserTeamFollowSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return UserTeamFollow.objects.filter(user=self.request.user)
