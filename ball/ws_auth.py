"""
JWT authentication for WebSocket connections (Channels).

Ball's HTTP API is JWT-only (SimpleJWT bearer tokens), but the default ASGI
stack authenticated WebSockets via `AuthMiddlewareStack` — i.e. Django session
cookies. React Native's `WebSocket` cannot set custom headers, and a JWT mobile
client holds no session cookie, so every mobile WS connection resolved to
`AnonymousUser` and was rejected by the consumers' `is_authenticated` guard.

This middleware reads a short-lived ACCESS token from the query string
(`ws/matches/<id>/?token=<access_jwt>`) — the standard workaround for
header-less WS clients — validates it with SimpleJWT, and sets `scope['user']`.
Wrap it INSIDE `AuthMiddlewareStack` so session auth still works for
browser/testing, and the token (when present) takes precedence.

Security notes:
  * Use the ACCESS token here (short-lived — 60 min per SIMPLE_JWT settings),
    never the refresh token: query strings can land in proxy/access logs.
  * An absent/invalid/expired token leaves the connection as AnonymousUser, so
    the consumers' existing `is_authenticated` guard rejects it — fail closed.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _get_user_from_token(raw_token):
    from django.contrib.auth import get_user_model
    from rest_framework_simplejwt.exceptions import TokenError
    from rest_framework_simplejwt.tokens import AccessToken

    User = get_user_model()
    try:
        access = AccessToken(raw_token)  # verifies signature + expiry
        return User.objects.get(id=access['user_id'])
    except (TokenError, KeyError, User.DoesNotExist):
        return AnonymousUser()


class JWTAuthMiddleware:
    """Sets scope['user'] from a `?token=` access JWT when present. Leaves any
    user already resolved by an outer session middleware untouched otherwise."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query = parse_qs(scope.get('query_string', b'').decode())
        token = query.get('token', [None])[0]
        if token:
            scope['user'] = await _get_user_from_token(token)
        return await self.inner(scope, receive, send)
