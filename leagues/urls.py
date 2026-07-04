from django.urls import path
from . import views

urlpatterns = [
    path('standings/sync/', views.SyncStandingsView.as_view(), name='sync_standings'),
    path('standings/', views.LeagueStandingsView.as_view(), name='league_standings'),

    path('player-stats/sync/', views.SyncPlayerStatsView.as_view(), name='sync_player_stats'),
    path('player-stats/', views.PlayerLeagueStatsView.as_view(), name='player_stats'),

    path('team-stats/sync/', views.SyncTeamStatisticsView.as_view(), name='sync_team_stats'),
    path('team-stats/', views.TeamStatisticsView.as_view(), name='team_stats'),

    path('sync/', views.SyncLeaguesView.as_view(), name='sync_leagues'),
    path('', views.LeagueListView.as_view(), name='league_list'),
]
