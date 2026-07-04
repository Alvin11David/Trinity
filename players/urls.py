from django.urls import path
from . import views

urlpatterns = [
    path('sync/', views.SyncPlayersView.as_view(), name='sync_players'),
    path('', views.TeamSquadView.as_view(), name='team_squad'),
]
