from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    # Auth
    path('register/', views.RegisterView.as_view(), name='register'),
    path('login/', TokenObtainPairView.as_view(), name='login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Phone verification
    path('phone/request-otp/', views.RequestOTPView.as_view(), name='request_otp'),
    path('phone/verify-otp/', views.VerifyOTPView.as_view(), name='verify_otp'),

    # Contacts
    path('contacts/sync/', views.SyncContactsView.as_view(), name='sync_contacts'),
    path('contacts/mutual/', views.MutualContactsView.as_view(), name='mutual_contacts'),

    # Profile
    path('me/', views.ProfileView.as_view(), name='profile'),

    # Follow (these come before username catch-all but after specific routes)
    path('<str:username>/follow/', views.FollowView.as_view(), name='follow'),
    path('<str:username>/followers/', views.FollowersListView.as_view(), name='followers'),
    path('<str:username>/following/', views.FollowingListView.as_view(), name='following'),

    # User detail catch-all (MUST be last)
    path('<str:username>/', views.UserDetailView.as_view(), name='user_detail'),
]