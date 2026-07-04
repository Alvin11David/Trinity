from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/users/', include('users.urls')),
    path('api/feed/', include('feed.urls')),
    path('api/chat/', include('chat.urls')),
    path('api/communities/', include('communities.urls')),
    path('api/matches/', include('matches.urls')),
    path('api/notifications/', include('notifications.urls')),
    path('api/leagues/', include('leagues.urls')),
    path('api/players/', include('players.urls')),
]