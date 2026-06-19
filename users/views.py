from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.db.models import Q
from .models import User, Follow, Contact, PhoneOTP, hash_phone
from .serializers import (
    UserSerializer, RegisterSerializer, FollowSerializer,
    RequestOTPSerializer, VerifyOTPSerializer, ContactSyncSerializer
)
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
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'username'


class FollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        target = get_object_or_404(User, username=username)
        if target == request.user:
            return Response({'error': 'You cannot follow yourself.'}, status=status.HTTP_400_BAD_REQUEST)
        follow, created = Follow.objects.get_or_create(follower=request.user, following=target)
        if not created:
            follow.delete()
            return Response({'status': 'unfollowed'})
        return Response({'status': 'followed'})


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