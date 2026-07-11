from django.db import models
from users.models import User


class Notification(models.Model):
    NOTIFICATION_TYPES = [
        ('kickoff', 'Kickoff Reminder'),
        ('goal', 'Goal Alert'),
        ('card', 'Card'),                    # added Step 8 (36.4 granularity)
        ('substitution', 'Substitution'),    # added Step 8 (36.4 granularity)
        ('reply', 'Reply'),
        ('repost', 'Repost'),
        ('follow', 'New Follower'),
        ('reaction', 'Reaction'),
        ('winnie_alert', 'Winnie Alert'),
        ('community_post', 'Community Post'),
        ('match_result', 'Match Result'),    # reused for full-time (FT)
        ('mention', 'Mention'),
    ]

    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    sender = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_notifications')
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    title = models.CharField(max_length=100)
    body = models.TextField(max_length=280)
    match_id = models.IntegerField(null=True, blank=True)
    post_id = models.IntegerField(null=True, blank=True)
    community_id = models.IntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.notification_type} for {self.recipient.username}"


class FCMToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fcm_tokens')
    token = models.TextField(unique=True)
    device_type = models.CharField(max_length=10, choices=[('android', 'Android'), ('ios', 'iOS')])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {self.device_type}"