from django.urls import path
from . import views

urlpatterns = [
    # Communities
    path('', views.CommunityListView.as_view(), name='communities'),
    path('<int:pk>/', views.CommunityDetailView.as_view(), name='community_detail'),
    path('<int:pk>/join/', views.JoinCommunityView.as_view(), name='join_community'),

    # Members
    path('<int:pk>/members/', views.CommunityMembersView.as_view(), name='community_members'),

    # Moderation (moderator-only)
    path('<int:pk>/members/<int:user_id>/kick/', views.KickCommunityMemberView.as_view(), name='kick_community_member'),
    path('<int:pk>/members/<int:user_id>/promote/', views.PromoteCommunityMemberView.as_view(), name='promote_community_member'),

    # Companion channel (moderator-only enablement)
    path('<int:pk>/room/create/', views.CreateCommunityRoomView.as_view(), name='create_community_room'),

    # Community Posts
    path('<int:pk>/posts/', views.CommunityPostListView.as_view(), name='community_posts'),
    path('<int:community_pk>/posts/<int:pk>/', views.CommunityPostDetailView.as_view(), name='community_post_detail'),
    path('posts/<int:pk>/vote/', views.CommunityPostVoteView.as_view(), name='community_post_vote'),
    path('posts/<int:pk>/pin/', views.PinPostView.as_view(), name='pin_community_post'),

    # User communities
    path('my/', views.UserCommunitiesView.as_view(), name='my_communities'),
]