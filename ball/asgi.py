import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import chat.routing
import matches.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ball.settings')

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AuthMiddlewareStack(
        URLRouter(
            chat.routing.websocket_urlpatterns +
            matches.routing.websocket_urlpatterns
        )
    ),
})