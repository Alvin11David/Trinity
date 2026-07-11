from django.db import models
from users.models import User


class Post(models.Model):
    # NOTE: 'poll' remains a defined enum value per CLAUDE.md 36.1 ("the enum
    # value can stay defined for future use") even though the Poll data
    # model/voting was removed during the Section 38 reconciliation (0 rows in
    # DB). No poll UI/data model is built; the choice is a reserved placeholder.
    POST_TYPES = [
        ('text', 'Text'),
        ('match_object', 'Match Object'),
        ('poll', 'Poll'),
        ('winnie_insight', 'Winnie Insight'),
    ]

    # Aggregate media readiness for the whole post. Posts with no media (or
    # only photos, which are ready on upload) are 'ready' immediately. A post
    # with an attached video starts 'processing' and is flipped to 'ready' by
    # the Mux webhook once transcoding finishes (CLAUDE.md 36.9).
    MEDIA_STATES = [
        ('ready', 'Ready'),
        ('processing', 'Processing'),
    ]

    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(max_length=500, blank=True)
    post_type = models.CharField(max_length=20, choices=POST_TYPES, default='text')

    # Real FK to Match (was a plain IntegerField before the Section 38
    # reconciliation). match_object posts point at the recap's source match;
    # SET_NULL keeps the recap post around even if the match row is ever purged.
    match = models.ForeignKey(
        'matches.Match', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='feed_posts',
    )

    repost_of = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='reposts',
    )

    media_state = models.CharField(max_length=12, choices=MEDIA_STATES, default='ready')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author.username}: {self.content[:50]}"


class PostMedia(models.Model):
    """
    Media attached to a plain user Post (CLAUDE.md 36.9). One row per attached
    photo/video; a Post may have several (X-style multi-photo) — the max-count
    rule (4 photos OR 1 video) is not enforced at the model level yet, flagged
    as an open item in 36.10.

    Video → Mux (direct upload, mux_* fields, thumbnail). Photo → S3 (storage_key
    + url + dimensions). Photos are 'ready' on creation; videos start
    'processing' and are flipped by the Mux webhook.
    """
    MEDIA_TYPES = [
        ('photo', 'Photo'),
        ('video', 'Video'),
    ]
    STATUSES = [
        ('processing', 'Processing'),
        ('ready', 'Ready'),
        ('failed', 'Failed'),
    ]

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='media')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    status = models.CharField(max_length=12, choices=STATUSES, default='ready')
    order = models.PositiveSmallIntegerField(default=0)

    # Photo (S3 + Pillow)
    url = models.URLField(max_length=800, blank=True, null=True)
    storage_key = models.CharField(max_length=500, blank=True, null=True)
    width = models.IntegerField(null=True, blank=True)
    height = models.IntegerField(null=True, blank=True)

    # Video (Mux)
    mux_upload_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    mux_asset_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    mux_playback_id = models.CharField(max_length=255, blank=True, null=True)
    thumbnail_url = models.URLField(max_length=800, blank=True, null=True)
    duration = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"{self.media_type} for post {self.post_id} ({self.status})"


class Reaction(models.Model):
    # Kept as-is through the Section 38 reconciliation. A Reaction row (of any
    # type) is THE engagement signal consumed by Discovery scoring (Step 5) —
    # no separate "Like" model was added.
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


class Comment(models.Model):
    """
    Threaded comments (CLAUDE.md 36.7). `parent` is a self-FK; null = top-level.
    The whole thread is fetched in ONE flat query and nested in application code
    (adjacency-list pattern) — no recursive SQL.
    """
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey(
        'self', null=True, blank=True,
        on_delete=models.CASCADE, related_name='replies',
    )
    content = models.TextField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.author.username} on post {self.post_id}: {self.content[:40]}"
