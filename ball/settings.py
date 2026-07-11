from pathlib import Path
from datetime import timedelta
import os
from dotenv import load_dotenv
from celery.schedules import crontab

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-change-this-in-production')

DEBUG = True

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'channels',
    'users',
    'feed',
    'chat',
    'communities',
    'matches',
    'notifications',
    'leagues',
    'players',
    'django_celery_beat',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ball.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ball.wsgi.application'
ASGI_APPLICATION = 'ball.asgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'ball',
        'USER': 'postgres',
        'PASSWORD': 'winnie2026',
        'HOST': 'localhost',
        'PORT': '5432',
    }
}

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [('127.0.0.1', 6379)],
        },
    },
}

# Shared cache backend (Redis DB 1 — broker uses DB 0). Feed discovery's
# trending pool is written by a Celery job and read by web requests, so the
# cache MUST be cross-process shared, not per-process LocMemCache (CLAUDE.md
# 36.6 / Step 5).
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://localhost:6379/1',
    }
}

CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Africa/Kampala'
CELERY_BEAT_SCHEDULER = 'django_celery_beat.schedulers:DatabaseScheduler'

CELERY_BEAT_SCHEDULE = {
    'check-finished-matches-frequent': {
        'task': 'matches.tasks.check_for_finished_matches',
        'schedule': crontab(minute='*/3'),
    },
    'sync-standings-daily-safety-net': {
        'task': 'leagues.tasks.sync_all_featured_standings',
        'schedule': crontab(hour=4, minute=0),
    },
    # Feed For You trending pool + hashtag trends (CLAUDE.md 36.6 / 37.4).
    'compute-feed-trending': {
        'task': 'feed.tasks.compute_trending',
        'schedule': crontab(minute='*/20'),
    },
}

AUTH_USER_MODEL = 'users.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
}

CORS_ALLOW_ALL_ORIGINS = True

AFRICASTALKING_USERNAME = os.getenv('AFRICAS_TALKING_USERNAME')
AFRICASTALKING_API_KEY = os.getenv('AFRICAS_TALKING_API_KEY')

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Kampala'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

WINNIE_API_BASE_URL = os.getenv('WINNIE_API_BASE_URL', 'http://127.0.0.1:8000')

API_FOOTBALL_BASE_URL = 'https://v3.football.api-sports.io'
API_FOOTBALL_KEY = os.getenv('API_FOOTBALL_KEY')

# --- Feed media pipeline (CLAUDE.md 36.9 / Step 4) ---
# Video → Mux direct upload (phone uploads straight to Mux, never through
# Django); a webhook flips the post processing → ready. Photos → S3 presigned
# PUT (direct-to-storage, same "no raw bytes through Django" principle),
# finalized server-side with Pillow. All credentials are optional at import
# time — the media endpoints return a clear 503 when a provider isn't
# configured, so the rest of the app runs without them.
MUX_TOKEN_ID = os.getenv('MUX_TOKEN_ID')
MUX_TOKEN_SECRET = os.getenv('MUX_TOKEN_SECRET')
MUX_WEBHOOK_SECRET = os.getenv('MUX_WEBHOOK_SECRET')
MUX_API_BASE_URL = 'https://api.mux.com'
# Max seconds of video accepted per upload (bounds Mux encoding cost — 36.10
# flagged this as undecided; 140s chosen as a sensible X-like default).
MUX_MAX_VIDEO_DURATION = int(os.getenv('MUX_MAX_VIDEO_DURATION', '140'))

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_S3_REGION = os.getenv('AWS_S3_REGION', 'us-east-1')
AWS_S3_BUCKET = os.getenv('AWS_S3_BUCKET')
# Public base URL used to build the displayable photo URL after upload. Defaults
# to the standard virtual-hosted S3 URL; override if fronted by a CDN.
AWS_S3_PUBLIC_BASE_URL = os.getenv('AWS_S3_PUBLIC_BASE_URL')