"""
Feed media provider integration (CLAUDE.md 36.9 / Step 4).

Video  → Mux direct upload. The phone requests a signed upload URL here, then
         PUTs the raw bytes STRAIGHT TO MUX — never through Django. Mux
         transcodes asynchronously and fires `video.asset.ready` to our webhook,
         which flips the PostMedia (and its Post) processing → ready.

Photo  → S3 presigned PUT + Pillow finalize.

36.10 OPEN ITEM RESOLVED HERE: photo upload ALSO goes direct-to-storage via a
presigned S3 PUT, consistent with the video pattern — the "don't route raw
bytes through Django" principle established for video in 36.9 applies equally to
photos. Pillow runs server-side ONLY in the post-upload finalize step (to
validate the file and read its dimensions), never on the upload path.

Every provider call is credential-guarded: if a provider isn't configured the
call raises MediaConfigError, which the views translate to a 503 — so the rest
of the app runs fine without Mux/AWS creds present.
"""
import base64
import hashlib
import hmac
import io
import uuid

import requests
from django.conf import settings


class MediaConfigError(Exception):
    """A media provider was invoked but isn't configured."""


# --------------------------------------------------------------------------- #
# Mux (video)
# --------------------------------------------------------------------------- #

def mux_configured():
    return bool(settings.MUX_TOKEN_ID and settings.MUX_TOKEN_SECRET)


def _mux_auth_header():
    raw = f"{settings.MUX_TOKEN_ID}:{settings.MUX_TOKEN_SECRET}".encode()
    return f"Basic {base64.b64encode(raw).decode()}"


def create_mux_direct_upload(cors_origin='*'):
    """Create a Mux direct upload; return {'upload_url', 'upload_id'}."""
    if not mux_configured():
        raise MediaConfigError('Mux is not configured (set MUX_TOKEN_ID / MUX_TOKEN_SECRET).')
    resp = requests.post(
        f"{settings.MUX_API_BASE_URL}/video/v1/uploads",
        headers={'Authorization': _mux_auth_header(), 'Content-Type': 'application/json'},
        json={
            'cors_origin': cors_origin,
            'new_asset_settings': {
                'playback_policy': ['public'],
                # basic tier: free encoding + free delivery minutes, positioned
                # for social/UGC (36.9). Uses Mux's CURRENT field name
                # (video_quality:'basic'); the old encoding_tier:'baseline' was
                # deprecated by Mux in 2024 and is avoided — fresh build, no
                # legacy constraint.
                'video_quality': 'basic',
            },
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()['data']
    return {'upload_url': data['url'], 'upload_id': data['id']}


def verify_mux_signature(raw_body: bytes, signature_header: str) -> bool:
    """Verify a Mux webhook `Mux-Signature: t=...,v1=...` header (HMAC-SHA256 of
    `{t}.{body}`). If no signing secret is configured, verification is skipped
    (returns True) so local/dev works without it."""
    if not settings.MUX_WEBHOOK_SECRET:
        return True
    if not signature_header:
        return False
    parts = dict(
        p.split('=', 1) for p in signature_header.split(',') if '=' in p
    )
    timestamp, sig = parts.get('t'), parts.get('v1')
    if not timestamp or not sig:
        return False
    signed_payload = f"{timestamp}.".encode() + raw_body
    expected = hmac.new(
        settings.MUX_WEBHOOK_SECRET.encode(), signed_payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig)


def mux_thumbnail_url(playback_id):
    return f"https://image.mux.com/{playback_id}/thumbnail.jpg"


# --------------------------------------------------------------------------- #
# S3 (photo)
# --------------------------------------------------------------------------- #

def s3_configured():
    return bool(
        settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.AWS_S3_BUCKET
    )


def _s3_client():
    import boto3
    return boto3.client(
        's3',
        region_name=settings.AWS_S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def public_url_for_key(key):
    base = settings.AWS_S3_PUBLIC_BASE_URL
    if base:
        return f"{base.rstrip('/')}/{key}"
    return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_S3_REGION}.amazonaws.com/{key}"


_EXT_FOR_CONTENT_TYPE = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
}


def create_s3_presigned_upload(content_type='image/jpeg'):
    """Presigned PUT for a direct-to-S3 photo upload. Returns
    {'upload_url', 'storage_key', 'public_url'}."""
    if not s3_configured():
        raise MediaConfigError('S3 is not configured (set AWS_* / AWS_S3_BUCKET).')
    ext = _EXT_FOR_CONTENT_TYPE.get(content_type, 'jpg')
    key = f"posts/{uuid.uuid4().hex}.{ext}"
    upload_url = _s3_client().generate_presigned_url(
        'put_object',
        Params={'Bucket': settings.AWS_S3_BUCKET, 'Key': key, 'ContentType': content_type},
        ExpiresIn=3600,
    )
    return {'upload_url': upload_url, 'storage_key': key, 'public_url': public_url_for_key(key)}


def finalize_photo(media):
    """After the phone confirms its S3 PUT, read the object back, validate it
    with Pillow, record dimensions + the public URL, and mark it ready."""
    if not s3_configured():
        raise MediaConfigError('S3 is not configured.')
    from PIL import Image

    obj = _s3_client().get_object(Bucket=settings.AWS_S3_BUCKET, Key=media.storage_key)
    body = obj['Body'].read()
    # verify() consumes the file object, so open twice (cheap, in-memory).
    Image.open(io.BytesIO(body)).verify()
    media.width, media.height = Image.open(io.BytesIO(body)).size
    media.url = public_url_for_key(media.storage_key)
    media.status = 'ready'
    media.save(update_fields=['width', 'height', 'url', 'status', 'updated_at'])
    return media
