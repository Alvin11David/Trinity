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
    # Read receipt: the moment this member last viewed the conversation. Works
    # uniformly for DMs and groups, and supersedes Message.is_read (see below).
    last_read_at = models.DateTimeField(null=True, blank=True)

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
    # DEPRECATED: superseded by Membership.last_read_at (a per-member read
    # cursor that generalizes to group conversations). No longer written; kept
    # only so historical rows don't need a destructive migration.
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.sender.username}: {self.content[:50]}"


class MessagePollVote(models.Model):
    """A single user's vote on a poll message (message_type='poll'). Poll
    options live in Message.metadata['options']; this records which option a
    user picked. Deliberately lean — not a revival of feed's removed
    Poll/PollOption/PollVote system. One vote per (user, message); re-voting
    updates option_index rather than inserting a duplicate."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='message_poll_votes')
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='poll_votes')
    option_index = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'message')

    def __str__(self):
        return f"{self.user.username} → option {self.option_index} on msg {self.message_id}"


class PinnedMessage(models.Model):
    """A message pinned to the top of a conversation. Capped at 5 per
    conversation (enforced in the view, not the DB). Match rooms cannot have
    pins at all. Position of the floating pin cards is a per-user, client-side
    concern — deliberately NOT stored here; the server only knows WHICH
    messages are pinned, never where a user drags the cards on their screen."""
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='pinned_messages')
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='pins')
    pinned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='pinned_messages')
    pinned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('conversation', 'message')
        ordering = ['pinned_at']

    def __str__(self):
        return f"Pinned msg {self.message_id} in conv {self.conversation_id}"