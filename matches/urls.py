from django.urls import path
from . import views

urlpatterns = [
    # Matches
    path('', views.MatchListView.as_view(), name='matches'),

    # Standings
    path('standings/sync/', views.SyncStandingsView.as_view(), name='sync_standings'),
    path('standings/', views.LeagueStandingsView.as_view(), name='league_standings'),

    path('<int:pk>/', views.MatchDetailView.as_view(), name='match_detail'),

    path('cards/batch/', views.MatchCardBatchView.as_view(), name='match_cards_batch'),

    path('live/', views.LiveMatchesView.as_view(), name='live_matches'),
    path('upcoming/', views.UpcomingMatchesView.as_view(), name='upcoming_matches'),

    # League
    path('league/<str:league>/', views.LeagueMatchesView.as_view(), name='league_matches'),

    # Match Room
    path('<int:pk>/room/', views.MatchRoomView.as_view(), name='match_room'),

    # Sync Predictions
    path('sync-predictions/', views.SyncPredictionsView.as_view(), name='sync_predictions'),
]