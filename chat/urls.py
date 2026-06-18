from django.urls import path
from . import views

urlpatterns = [
    # Conversations
    path('', views.ConversationListView.as_view(), name='conversations'),
    path('<int:pk>/', views.ConversationDetailView.as_view(), name='conversation_detail'),
    path('<int:pk>/leave/', views.LeaveConversationView.as_view(), name='leave_conversation'),

    # Messages
    path('<int:pk>/messages/', views.MessageListView.as_view(), name='messages'),
    path('<int:pk>/messages/send/', views.MessageCreateView.as_view(), name='send_message'),

    # Channels
    path('channels/public/', views.PublicChannelsView.as_view(), name='public_channels'),
    path('channels/<int:pk>/join/', views.JoinChannelView.as_view(), name='join_channel'),
]