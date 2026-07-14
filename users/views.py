from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.db.models import Q
from .models import User, Follow, Contact, PhoneOTP, Block, Report, hash_phone
from .serializers import (
    UserSerializer, RegisterSerializer, FollowSerializer,
    RequestOTPSerializer, VerifyOTPSerializer, ContactSyncSerializer,
    ProfileSerializer, ProfileUpdateSerializer, ReportSerializer,
)
from .blocking import is_blocked_between
import africastalking


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)


class ProfileView(generics.RetrieveUpdateAPIView):
    """The signed-in user's own profile. GET returns the full UserSerializer;
    PATCH/PUT go through ProfileUpdateSerializer (username/bio/avatar + favorite
    team/league — Step 6)."""
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return ProfileUpdateSerializer
        return UserSerializer


class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'username'


class ProfileDetailView(generics.RetrieveAPIView):
    """Aggregate profile for any user (Step 4). A blocked relationship in either
    direction fully HIDES the profile (404) — not just disabled buttons (Step 2's
    profile-visibility rule)."""
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'username'

    def get_object(self):
        target = get_object_or_404(User, username=self.kwargs['username'])
        if target != self.request.user and is_blocked_between(self.request.user, target):
            from django.http import Http404
            raise Http404('User not available.')
        return target


class FollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        target = get_object_or_404(User, username=username)
        if target == request.user:
            return Response({'error': 'You cannot follow yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        # A block (either direction) can't coexist with a follow.
        if is_blocked_between(request.user, target):
            return Response({'error': 'Unavailable.'}, status=status.HTTP_403_FORBIDDEN)
        follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
        if not created:
            follow.delete()
            return Response({'status': 'unfollowed'})
        return Response({'status': 'followed'})


class BlockView(APIView):
    """POST → block a user (Step 2): creates the Block and auto-deletes any
    Follow rows in BOTH directions (a block and a follow can't coexist).
    DELETE → unblock (plain delete of the Block row; no auto-refollow)."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        target = get_object_or_404(User, username=username)
        if target == request.user:
            return Response({'error': 'You cannot block yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        Block.objects.get_or_create(blocker=request.user, blocked=target)
        # Blocking severs any existing follow relationship in both directions.
        Follow.objects.filter(follower=request.user, following=target).delete()
        Follow.objects.filter(follower=target, following=request.user).delete()
        return Response({'status': 'blocked'})

    def delete(self, request, username):
        target = get_object_or_404(User, username=username)
        Block.objects.filter(blocker=request.user, blocked=target).delete()
        return Response({'status': 'unblocked'})


class ReportView(APIView):
    """Report a user (Step 3). Captures the report only — no moderation UI."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        target = get_object_or_404(User, username=username)
        if target == request.user:
            return Response({'error': 'You cannot report yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = ReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(reporter=request.user, reported_user=target)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PinPostView(APIView):
    """Set/clear the signed-in user's single pinned post (Step 1). POST with
    {post_id} pins (replacing any prior pin automatically); DELETE clears it. A
    user may only pin their OWN post."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from feed.models import Post
        post = get_object_or_404(Post, pk=request.data.get('post_id'))
        if post.author_id != request.user.id:
            return Response({'error': 'You can only pin your own post.'},
                            status=status.HTTP_403_FORBIDDEN)
        request.user.pinned_post = post
        request.user.save(update_fields=['pinned_post'])
        return Response({'status': 'pinned', 'post_id': post.id})

    def delete(self, request):
        request.user.pinned_post = None
        request.user.save(update_fields=['pinned_post'])
        return Response({'status': 'unpinned'})


class FollowersListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = get_object_or_404(User, username=self.kwargs['username'])
        return User.objects.filter(following__following=user)


class FollowingListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = get_object_or_404(User, username=self.kwargs['username'])
        return User.objects.filter(followers__follower=user)


class RequestOTPView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data['phone_number']

        if User.objects.filter(phone_hash=hash_phone(phone_number), phone_verified=True).exclude(pk=request.user.pk).exists():
            return Response({'error': 'Phone number already in use.'}, status=status.HTTP_400_BAD_REQUEST)

        code = PhoneOTP.generate_code()
        PhoneOTP.objects.create(phone_number=phone_number, code=code)

        africastalking.initialize(settings.AFRICASTALKING_USERNAME, settings.AFRICASTALKING_API_KEY)
        sms = africastalking.SMS
        try:
            sms.send(f"Your Ball verification code is {code}", [phone_number])
        except Exception as e:
            return Response({'error': f'Failed to send SMS: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'status': 'OTP sent'})


class VerifyOTPView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_number = serializer.validated_data['phone_number']
        code = serializer.validated_data['code']

        otp = PhoneOTP.objects.filter(
            phone_number=phone_number, code=code, is_used=False
        ).order_by('-created_at').first()

        if not otp:
            return Response({'error': 'Invalid code.'}, status=status.HTTP_400_BAD_REQUEST)
        if otp.is_expired():
            return Response({'error': 'Code expired.'}, status=status.HTTP_400_BAD_REQUEST)

        otp.is_used = True
        otp.save()

        user = request.user
        user.phone_number = phone_number
        user.phone_verified = True
        user.save()

        return Response({'status': 'phone verified', 'phone_number': phone_number})


class SyncContactsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ContactSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone_numbers = serializer.validated_data['phone_numbers']

        matched = []
        for number in phone_numbers:
            phash = hash_phone(number)
            matched_user = User.objects.filter(phone_hash=phash, phone_verified=True).exclude(pk=request.user.pk).first()
            Contact.objects.update_or_create(
                user=request.user,
                phone_hash=phash,
                defaults={'matched_user': matched_user}
            )
            if matched_user:
                matched.append(matched_user)

        return Response({
            'matched_count': len(matched),
            'matched_users': UserSerializer(matched, many=True).data
        })


class MutualContactsView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        my_contacts = Contact.objects.filter(user=user, matched_user__isnull=False).values_list('matched_user_id', flat=True)
        mutual_ids = Contact.objects.filter(
            user_id__in=my_contacts, matched_user=user
        ).values_list('user_id', flat=True)
        return User.objects.filter(id__in=mutual_ids)