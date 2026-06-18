from django.db import models
from users.models import User


class Conversation(models.Model):
    CONVERSATION_TYPES = [
        ('direct', 'Direct Message'),
        ('group', 'Group Chat'),
        ('channel', 'Channel'),
    ]

    CHANNEL_MODES = [
        ('open', 'Open'),
        ('broadcast', 'Broadcast'),
    ]

    conversation_type = models.CharField(max_length=10, choices=CONVERSATION_TYPES, default='direct')
    channel_mode = models.CharField(max_length=10, choices=CHANNEL_MODES, null=True, blank=True)
    name = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(max_length=280, blank=True, null=True)
    avatar = models.URLField(blank=True, null=True)
    participants = models.ManyToManyField(User, through='Membership', related_name='conversations')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_conversations')
    is_public = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.name or f"Conversation {self.id}"


class Membership(models.Model):
    ROLES = [
        ('admin', 'Admin'),
        ('member', 'Member'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='memberships')
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=10, choices=ROLES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'conversation')

    def __str__(self):
        return f"{self.user.username} in {self.conversation}"


class Message(models.Model):
    MESSAGE_TYPES = [
        ('text', 'Text'),
        ('match_card', 'Match Card'),
        ('prediction_card', 'Prediction Card'),
        ('poll', 'Poll'),
        ('goal_event', 'Goal Event'),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    content = models.TextField(blank=True)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    match_id = models.IntegerField(null=True, blank=True)
    metadata = models.JSONField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}"