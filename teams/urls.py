from django.urls import path
from . import views

urlpatterns = [
    path('sync/', views.SyncTeamsView.as_view(), name='sync_teams'),
    path('', views.TeamListView.as_view(), name='team_list'),
    path('<int:pk>/', views.TeamDetailView.as_view(), name='team_detail'),
]
