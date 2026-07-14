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
    path('me/pin/', views.PinPostView.as_view(), name='pin_post'),

    # Follow / block / report / aggregate profile (all before the username
    # catch-all but after the specific routes above)
    path('<str:username>/follow/', views.FollowView.as_view(), name='follow'),
    path('<str:username>/block/', views.BlockView.as_view(), name='block'),
    path('<str:username>/report/', views.ReportView.as_view(), name='report'),
    path('<str:username>/profile/', views.ProfileDetailView.as_view(), name='profile_detail'),
    path('<str:username>/followers/', views.FollowersListView.as_view(), name='followers'),
    path('<str:username>/following/', views.FollowingListView.as_view(), name='following'),

    # User detail catch-all (MUST be last)
    path('<str:username>/', views.UserDetailView.as_view(), name='user_detail'),
]