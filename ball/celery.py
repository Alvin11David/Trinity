import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ball.settings')

app = Celery('ball')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
