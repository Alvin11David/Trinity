from django.contrib.auth.models import AbstractUser
from django.db import models
import hashlib


class User(AbstractUser):
    favorite_club = models.CharField(max_length=100, blank=True, null=True)
    bio = models.TextField(max_length=280, blank=True)
    avatar = models.URLField(blank=True, null=True)
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

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
    phone_hash = models.CharField(max_length=64)  # SHA256 hash of phone number
    matched_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='contact_of')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'phone_hash')

    def __str__(self):
        return f"{self.user.username} contact → {self.matched_user}"

    @staticmethod
    def hash_phone(phone_number):
        normalized = ''.join(filter(str.isdigit, phone_number))
        return hashlib.sha256(normalized.encode()).hexdigest()