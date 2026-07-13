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
    path('messages/<int:pk>/poll/vote/', views.MessagePollVoteView.as_view(), name='message_poll_vote'),

    # Members
    path('<int:pk>/members/', views.ConversationMembersView.as_view(), name='conversation_members'),

    # Moderation (admin-only)
    path('<int:pk>/members/<int:user_id>/kick/', views.KickMemberView.as_view(), name='kick_member'),
    path('<int:pk>/members/<int:user_id>/promote/', views.PromoteMemberView.as_view(), name='promote_member'),

    # Channels
    path('channels/public/', views.PublicChannelsView.as_view(), name='public_channels'),
    path('channels/<int:pk>/join/', views.JoinChannelView.as_view(), name='join_channel'),
]