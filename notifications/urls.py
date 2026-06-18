from django.urls import path
from . import views

urlpatterns = [
    # Notifications
    path('', views.NotificationListView.as_view(), name='notifications'),
    path('unread/', views.UnreadNotificationsView.as_view(), name='unread_notifications'),
    path('unread/count/', views.UnreadCountView.as_view(), name='unread_count'),
    path('<int:pk>/read/', views.MarkNotificationReadView.as_view(), name='mark_read'),
    path('read-all/', views.MarkAllReadView.as_view(), name='mark_all_read'),

    # FCM
    path('fcm/register/', views.FCMTokenView.as_view(), name='fcm_register'),
]