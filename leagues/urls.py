from django.urls import path
from . import views

urlpatterns = [
    path('standings/sync/', views.SyncStandingsView.as_view(), name='sync_standings'),
    path('standings/', views.LeagueStandingsView.as_view(), name='league_standings'),
]
