"""
Expo push delivery (CLAUDE.md 36.4 / Step 8).

Sends via Expo's push service (https://exp.host/--/api/v2/push/send), which
relays to APNs/FCM for us — no direct APNs/FCM credentials needed on our side.
Free for delivery at any tier. If a user has no registered Expo token this is a
no-op; failures are swallowed so push never breaks the notification fan-out
(in-app Notification rows are the source of truth).
"""
import logging

import requests

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'


def send_expo_push(user_ids, title, body, data=None):
    """Push `title`/`body` to every Expo token owned by the given users.
    Returns the number of token messages attempted."""
    from .models import ExpoPushToken

    tokens = list(
        ExpoPushToken.objects.filter(user_id__in=list(user_ids))
        .values_list('token', flat=True)
    )
    if not tokens:
        return 0

    messages = [
        {
            'to': token,
            'title': title,
            'body': body,
            'sound': 'default',
            'data': data or {},
        }
        for token in tokens
    ]
    try:
        # Expo accepts a batch array in one request.
        requests.post(
            EXPO_PUSH_URL,
            json=messages,
            headers={'Content-Type': 'application/json', 'Accept': 'application/json'},
            timeout=10,
        )
    except requests.RequestException as exc:  # pragma: no cover - network
        logger.warning(f"Expo push failed: {exc}")
    return len(messages)
