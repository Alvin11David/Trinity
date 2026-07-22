from django.urls import path
from . import views

urlpatterns = [
    path('sync/', views.SyncPlayersView.as_view(), name='sync_players'),

    path('countries/sync/', views.SyncCountriesView.as_view(), name='sync_countries'),
    path('countries/', views.CountryListView.as_view(), name='country_list'),

    path('search/', views.PlayerSearchView.as_view(), name='player_search'),

    # Transfermarkt enrichment (player_id = API-Football id).
    path('<int:player_id>/market-value-history/', views.PlayerMarketValueHistoryView.as_view(), name='player_mv_history'),
    path('<int:player_id>/transfers/', views.PlayerTransfersView.as_view(), name='player_transfers'),

    path('', views.TeamSquadView.as_view(), name='team_squad'),
]
