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
    # avatar/banner both hold the PUBLIC S3 URL written by the resize-on-finalize
    # step of the shared photo pipeline (feed/media.py). They stay plain URL
    # fields — the upload flow just populates them, replacing the old
    # manual-URL-entry avatar (CLAUDE.md 36.9 reuse, not a second pipeline).
    avatar = models.URLField(blank=True, null=True)
    banner = models.URLField(blank=True, null=True)  # X-style wide header image
    phone_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    phone_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    phone_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Favorite team/league (Step 1). Both optional and INDEPENDENT — no forced
    # exclusivity; whichever is set displays, both set is harmless. The team is
    # denormalized (id + name, matching UserTeamFollow's convention — there is no
    # Team model); the league is a real FK (matching UserLeagueFollow). These are
    # distinct from the legacy free-text `favorite_club` above, kept as-is.
    # Favorite team as a Team FK (Phase 5): replaced the denormalized
    # favorite_team_id/name/logo. `favorite_team_id` still works as this FK's
    # attname, so the API's favorite_team_id in/out is unchanged.
    favorite_team = models.ForeignKey(
        'teams.Team', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )
    favorite_league = models.ForeignKey(
        'leagues.League', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )

    # A single pinned post (Step 1). NOT a boolean flag on Post — pinning a new
    # post just points this FK at it, which automatically replaces any prior pin
    # (no separate "unpin the old one" step). SET_NULL so deleting the post
    # silently clears the pin.
    pinned_post = models.ForeignKey(
        'feed.Post', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )

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


class Block(models.Model):
    """A blocks B (Step 2). This is a REAL block, not cosmetic — see
    users/blocking.py for the shared filter and the effects wired across DMs,
    Follow, Search, Feed, and profile visibility. Creating a Block auto-deletes
    any Follow rows in both directions (a block and a follow can't coexist).
    Unblocking is a plain delete of this row — no auto-refollow."""
    blocker = models.ForeignKey(User, related_name='blocking', on_delete=models.CASCADE)
    blocked = models.ForeignKey(User, related_name='blocked_by', on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')

    def __str__(self):
        return f"{self.blocker} blocked {self.blocked}"


class Report(models.Model):
    """A user reporting another user (Step 3). Scoped to reporting a USER only —
    reporting individual posts/messages is deliberately out of scope. This just
    captures the report; there is no moderation-side review UI yet."""
    REASONS = [
        ('spam', 'Spam'),
        ('harassment', 'Harassment'),
        ('impersonation', 'Impersonation'),
        ('other', 'Other'),
    ]
    reporter = models.ForeignKey(User, related_name='reports_made', on_delete=models.CASCADE)
    reported_user = models.ForeignKey(User, related_name='reports_received', on_delete=models.CASCADE)
    reason = models.CharField(max_length=20, choices=REASONS)
    detail = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.reporter} reported {self.reported_user} ({self.reason})"


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