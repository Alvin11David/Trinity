from django.db import models
from users.models import User


class Post(models.Model):
    POST_TYPES = [
        ('text', 'Text'),
        ('match_object', 'Match Object'),
        ('poll', 'Poll'),
        ('winnie_insight', 'Winnie Insight'),
    ]

    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(max_length=500, blank=True)
    post_type = models.CharField(max_length=20, choices=POST_TYPES, default='text')
    match_id = models.IntegerField(null=True, blank=True)
    repost_of = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='reposts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author.username}: {self.content[:50]}"


class Reaction(models.Model):
    REACTION_TYPES = [
        ('goal', 'Goal'),
        ('hot_take', 'Hot Take'),
        ('smart', 'Smart'),
        ('terrible', 'Terrible Take'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reactions')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='reactions')
    reaction_type = models.CharField(max_length=20, choices=REACTION_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'post')

    def __str__(self):
        return f"{self.user.username} reacted {self.reaction_type} to post {self.post.id}"


class Poll(models.Model):
    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name='poll')
    question = models.CharField(max_length=280)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.question


class PollOption(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=100)

    def __str__(self):
        return self.text


class PollVote(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='votes')
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name='votes')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='poll_votes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('poll', 'user')

    def __str__(self):
        return f"{self.user.username} voted {self.option.text}"