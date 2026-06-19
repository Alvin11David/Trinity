from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import hashlib
import random


def hash_phone(phone_number):
    normalized = ''.join(filter(str.isdigit, phone_number))
    return hashlib.sha256(normalized.encode()).hexdigest()


class User(AbstractUser):
    favorite_club = models.CharField(max_length=100, blank=True, null=True)
    bio = models.TextField(max_length=280, blank=True)
    avatar = models.URLField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    phone_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    phone_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.phone_number:
            self.phone_hash = hash_phone(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.username


class Follow(models.Model):
    follower = models.ForeignKey(User, related_name='following', on_delete=models.CASCADE)
    following = models.ForeignKey(User, related_name='followers', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('follower', 'following')

    def __str__(self):
        return f"{self.follower} follows {self.following}"


class Contact(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='contacts')
    phone_hash = models.CharField(max_length=64, db_index=True)
    matched_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='contact_of')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'phone_hash')

    def __str__(self):
        return f"{self.user.username} contact → {self.matched_user}"


class PhoneOTP(models.Model):
    phone_number = models.CharField(max_length=20)
    code = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    def is_expired(self):
        return (timezone.now() - self.created_at).seconds > 300  # 5 minutes

    @staticmethod
    def generate_code():
        return str(random.randint(100000, 999999))

    def __str__(self):
        return f"OTP for {self.phone_number}"