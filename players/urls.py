from django.urls import path
from . import views

urlpatterns = [
    path('sync/', views.SyncPlayersView.as_view(), name='sync_players'),

    path('countries/sync/', views.SyncCountriesView.as_view(), name='sync_countries'),
    path('countries/', views.CountryListView.as_view(), name='country_list'),

    path('', views.TeamSquadView.as_view(), name='team_squad'),
]
