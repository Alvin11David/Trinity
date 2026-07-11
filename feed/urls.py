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

    # Media pipeline (Step 4)
    path('media/upload-url/', views.MediaUploadURLView.as_view(), name='media_upload_url'),
    path('media/<int:pk>/finalize/', views.PhotoFinalizeView.as_view(), name='media_finalize'),
    path('media/mux-webhook/', views.MuxWebhookView.as_view(), name='mux_webhook'),

    # Search (Step 6)
    path('search/', views.SearchView.as_view(), name='search'),

    # User posts
    path('users/<str:username>/posts/', views.UserPostsView.as_view(), name='user_posts'),
]