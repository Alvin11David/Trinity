from django.urls import path
from . import views

urlpatterns = [
    # Matches
    path('', views.MatchListView.as_view(), name='matches'),

    # Fixtures
    path('fixtures/sync/', views.SyncFixturesView.as_view(), name='sync_fixtures'),

    path('<int:pk>/', views.MatchDetailView.as_view(), name='match_detail'),
    path('<int:match_id>/odds/', views.MatchOddsView.as_view(), name='match_odds'),

    path('cards/batch/', views.MatchCardBatchView.as_view(), name='match_cards_batch'),

    path('live/', views.LiveMatchesView.as_view(), name='live_matches'),
    path('upcoming/', views.UpcomingMatchesView.as_view(), name='upcoming_matches'),

    # League
    path('league/<int:league_id>/', views.LeagueMatchesView.as_view(), name='league_matches'),

    # Team
    path('team/<int:team_id>/', views.TeamMatchesView.as_view(), name='team_matches'),
    path('team/<int:team_id>/profile/', views.TeamProfileView.as_view(), name='team_profile'),

    # Player match history
    path('player/<int:player_id>/history/', views.PlayerMatchHistoryView.as_view(), name='player_match_history'),

    # Match Room
    path('<int:pk>/room/', views.MatchRoomView.as_view(), name='match_room'),

    # Sync Predictions
    path('sync-predictions/', views.SyncPredictionsView.as_view(), name='sync_predictions'),
]