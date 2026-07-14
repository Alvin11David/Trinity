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
from .blocking import is_blocked_between, blocked_user_ids
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
    """Aggregate profile for any user (Step 4). When a block exists in either
    direction the profile CONTENT is fully hidden (Step 2's visibility rule) —
    the serializer masks bio/avatar/counts/favorites/pinned post server-side, so
    nothing leaks over the API. The endpoint still resolves (rather than 404ing)
    so the blocker can reach an Unblock affordance; the frontend renders the
    blocked state from the is_blocked / is_blocked_by flags."""
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'username'
    queryset = User.objects.all()


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


class BlockedAccountsView(generics.ListAPIView):
    """The canonical, always-reachable list of accounts the requester has blocked
    (Settings → Blocked Accounts). Unblocking is done via the existing
    DELETE /api/users/<username>/block/ — this view is purely the review surface.
    The masked stale-link profile view (ProfileDetailView) is unchanged and is
    NOT a discovery path; this list is."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users this requester has blocked (blocker direction only), most-recently
        # blocked first. `blocked_by` is the reverse relation on Block.blocked, so
        # this joins each user to their Block row authored by the requester — one
        # row per user (unique_together(blocker, blocked)), no duplicates.
        return (
            User.objects.filter(blocked_by__blocker=self.request.user)
            .order_by('-blocked_by__created_at')
        )


class ProfileImageUploadURLView(APIView):
    """Issue a direct-to-S3 presigned PUT for the caller's own avatar or banner
    (Step 4). Reuses the post-photo pipeline's presigned-upload mechanism — the
    phone PUTs raw bytes straight to S3, never through Django. `kind` scopes the
    S3 key prefix (avatars/ or banners/)."""
    permission_classes = [permissions.IsAuthenticated]

    ALLOWED_TYPES = ('image/jpeg', 'image/png', 'image/webp')

    def post(self, request):
        from feed import media as media_lib

        kind = request.data.get('kind')
        if kind not in ('avatar', 'banner'):
            return Response({'error': "kind must be 'avatar' or 'banner'."},
                            status=status.HTTP_400_BAD_REQUEST)
        content_type = request.data.get('content_type', 'image/jpeg')
        if content_type not in self.ALLOWED_TYPES:
            return Response({'error': 'Unsupported image type (use JPEG, PNG, or WebP).'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            cred = media_lib.create_s3_presigned_upload(content_type=content_type, prefix=f'{kind}s')
        except media_lib.MediaConfigError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            'kind': kind,
            'upload_url': cred['upload_url'],
            'storage_key': cred['storage_key'],
            'content_type': content_type,
        }, status=status.HTTP_201_CREATED)


class ProfileImageFinalizeView(APIView):
    """Called after the phone's direct S3 PUT succeeds. Reads the object back,
    validates + cover-crops + resizes it to the target for its kind (avatar →
    400×400 square, banner → 1500×500 wide) via the shared Pillow finalize, then
    writes the resulting public URL onto the user's avatar/banner."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from feed import media as media_lib

        kind = request.data.get('kind')
        storage_key = request.data.get('storage_key') or ''
        if kind not in ('avatar', 'banner'):
            return Response({'error': "kind must be 'avatar' or 'banner'."},
                            status=status.HTTP_400_BAD_REQUEST)
        # The key must live under this kind's own prefix — a cheap guard so a
        # finalize can't point at an arbitrary object namespace.
        if not storage_key.startswith(f'{kind}s/'):
            return Response({'error': 'Invalid storage key.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            url = media_lib.finalize_profile_image(storage_key, kind)
        except media_lib.MediaConfigError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response({'error': f'Could not process image: {exc}'},
                            status=status.HTTP_400_BAD_REQUEST)

        setattr(request.user, kind, url)
        request.user.save(update_fields=[kind])
        return Response(UserSerializer(request.user, context={'request': request}).data)


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


# --------------------------------------------------------------------------- #
# Activity → People (new queries over existing data; NO new models)
# --------------------------------------------------------------------------- #

class NewFollowersView(generics.ListAPIView):
    """People who follow the viewer but whom the viewer doesn't follow back — the
    'Follow-Back' list for the Activity → People segment. Ball's Follow is one-way
    and instant (no accept/reject), so this is purely a discovery surface. Blocked
    users (either direction) are excluded."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        viewer = self.request.user
        following_ids = Follow.objects.filter(follower=viewer).values_list('following_id', flat=True)
        follower_ids = Follow.objects.filter(following=viewer).values_list('follower_id', flat=True)
        return (
            User.objects.filter(id__in=follower_ids)
            .exclude(id__in=following_ids)             # not already followed back
            .exclude(id__in=blocked_user_ids(viewer)) # not blocked either way
            .order_by('-id')
        )


class SuggestedPeopleView(APIView):
    """Suggested People for Activity → People. Three parallel candidate sources
    (same merge/dedup shape as Discovery's 36.6 candidate pools, pointed at people
    instead of posts), each carrying a reason + count for the frontend chip:

      * interaction       — people the viewer reacted to / commented on, or who
                            engaged the viewer's posts (Reaction, Comment)
      * mutual_follows    — friend-of-friend over Follow
      * groups_in_common  — shared communities or group chats

    All three exclude the viewer, anyone already followed, and anyone blocked in
    either direction. No weighted ranking for v1 — a simple merge/dedup ordered by
    total signal is enough.
    """
    permission_classes = [permissions.IsAuthenticated]
    LIMIT = 30

    def get(self, request):
        from collections import defaultdict
        from django.db.models import Count
        from feed.models import Reaction, Comment
        from communities.models import CommunityMembership
        from chat.models import Membership as ChatMembership

        viewer = request.user
        following_ids = set(Follow.objects.filter(follower=viewer).values_list('following_id', flat=True))
        excluded = {viewer.id} | following_ids | blocked_user_ids(viewer)

        reasons = defaultdict(lambda: defaultdict(int))

        # --- Source 1: interaction (both directions) ---
        interaction = defaultdict(int)
        for uid in Reaction.objects.filter(user=viewer).values_list('post__author_id', flat=True):
            interaction[uid] += 1
        for uid in Comment.objects.filter(author=viewer).values_list('post__author_id', flat=True):
            interaction[uid] += 1
        for uid in Reaction.objects.filter(post__author=viewer).values_list('user_id', flat=True):
            interaction[uid] += 1
        for uid in Comment.objects.filter(post__author=viewer).values_list('author_id', flat=True):
            interaction[uid] += 1
        for uid, n in interaction.items():
            if uid not in excluded:
                reasons[uid]['interaction'] = n

        # --- Source 2: mutual follows (people my follows follow) ---
        if following_ids:
            mf = (
                Follow.objects.filter(follower_id__in=following_ids)
                .exclude(following_id__in=excluded)
                .values('following_id')
                .annotate(c=Count('follower_id', distinct=True))
            )
            for row in mf:
                reasons[row['following_id']]['mutual_follows'] = row['c']

        # --- Source 3: groups in common (communities + group chats) ---
        my_comm_ids = CommunityMembership.objects.filter(user=viewer).values_list('community_id', flat=True)
        if my_comm_ids:
            cc = (
                CommunityMembership.objects.filter(community_id__in=list(my_comm_ids))
                .exclude(user_id__in=excluded)
                .values('user_id')
                .annotate(c=Count('community_id', distinct=True))
            )
            for row in cc:
                reasons[row['user_id']]['groups_in_common'] += row['c']

        my_group_ids = ChatMembership.objects.filter(
            user=viewer, conversation__conversation_type='group'
        ).values_list('conversation_id', flat=True)
        if my_group_ids:
            gc = (
                ChatMembership.objects.filter(conversation_id__in=list(my_group_ids))
                .exclude(user_id__in=excluded)
                .values('user_id')
                .annotate(c=Count('conversation_id', distinct=True))
            )
            for row in gc:
                reasons[row['user_id']]['groups_in_common'] += row['c']

        # Merge/dedup: order by total signal (simple, not weighted), cap the list.
        ranked_ids = sorted(
            reasons.keys(),
            key=lambda uid: sum(reasons[uid].values()),
            reverse=True,
        )[:self.LIMIT]

        users_by_id = {u.id: u for u in User.objects.filter(id__in=ranked_ids)}
        # Reason chips in a stable priority order so the client can show the first.
        PRIORITY = ['mutual_follows', 'groups_in_common', 'interaction']
        results = []
        for uid in ranked_ids:
            user = users_by_id.get(uid)
            if not user:
                continue
            chips = [
                {'type': t, 'count': reasons[uid][t]}
                for t in PRIORITY if reasons[uid].get(t)
            ]
            results.append({
                'user': UserSerializer(user, context={'request': request}).data,
                'reasons': chips,
            })

        return Response(results)