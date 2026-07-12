import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ball.settings')

# Import routing + our JWT middleware AFTER the settings module is set, so app
# models/settings are ready when Channels resolves the consumers.
import chat.routing
import matches.routing
from ball.ws_auth import JWTAuthMiddleware

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    # AuthMiddlewareStack keeps session auth working for browser/testing;
    # JWTAuthMiddleware (inner) overrides scope['user'] from a ?token= access
    # JWT when present — the only path that works for header-less RN clients.
    # This also fixes the identical latent gap in the existing chat WS.
    'websocket': AuthMiddlewareStack(
        JWTAuthMiddleware(
            URLRouter(
                chat.routing.websocket_urlpatterns +
                matches.routing.websocket_urlpatterns
            )
        )
    ),
})