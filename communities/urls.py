from django.urls import path
from . import views

urlpatterns = [
    # Communities
    path('', views.CommunityListView.as_view(), name='communities'),
    path('<int:pk>/', views.CommunityDetailView.as_view(), name='community_detail'),
    path('<int:pk>/join/', views.JoinCommunityView.as_view(), name='join_community'),

    # Community Posts
    path('<int:pk>/posts/', views.CommunityPostListView.as_view(), name='community_posts'),
    path('<int:community_pk>/posts/<int:pk>/', views.CommunityPostDetailView.as_view(), name='community_post_detail'),
    path('posts/<int:pk>/vote/', views.CommunityPostVoteView.as_view(), name='community_post_vote'),

    # User communities
    path('my/', views.UserCommunitiesView.as_view(), name='my_communities'),
]