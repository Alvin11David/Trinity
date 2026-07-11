from django.urls import path
from . import views

urlpatterns = [
    # Feed
    path('', views.FeedView.as_view(), name='feed'),
    path('global/', views.GlobalFeedView.as_view(), name='global_feed'),

    # Posts
    path('posts/', views.PostCreateView.as_view(), name='post_create'),
    path('posts/<int:pk>/', views.PostDetailView.as_view(), name='post_detail'),

    # Reactions
    path('posts/<int:pk>/react/', views.ReactionView.as_view(), name='react'),

    # Comments (threaded)
    path('posts/<int:pk>/comments/', views.PostCommentsView.as_view(), name='post_comments'),
    path('comments/<int:pk>/', views.CommentDeleteView.as_view(), name='comment_delete'),

    # User posts
    path('users/<str:username>/posts/', views.UserPostsView.as_view(), name='user_posts'),
]