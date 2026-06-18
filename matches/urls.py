from django.urls import path
from . import views

urlpatterns = [
    # Matches
    path('', views.MatchListView.as_view(), name='matches'),
    path('<int:pk>/', views.MatchDetailView.as_view(), name='match_detail'),
    path('live/', views.LiveMatchesView.as_view(), name='live_matches'),
    path('upcoming/', views.UpcomingMatchesView.as_view(), name='upcoming_matches'),

    # League
    path('league/<str:league>/', views.LeagueMatchesView.as_view(), name='league_matches'),

    # Match Room
    path('<int:pk>/room/', views.MatchRoomView.as_view(), name='match_room'),
]