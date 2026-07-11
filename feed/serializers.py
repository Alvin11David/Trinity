from rest_framework import serializers
from .models import Post, PostMedia, Reaction
from users.serializers import UserSerializer
from matches.models import Match


class PostMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostMedia
        fields = [
            'id', 'media_type', 'status', 'order',
            'url', 'width', 'height',
            'mux_playback_id', 'thumbnail_url', 'duration',
        ]


class ReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reaction
        fields = ['id', 'user', 'reaction_type', 'created_at']


class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    reactions_count = serializers.SerializerMethodField()
    reposts_count = serializers.SerializerMethodField()
    user_reaction = serializers.SerializerMethodField()
    match_card = serializers.SerializerMethodField()
    media = PostMediaSerializer(many=True, read_only=True)
    # Preserve the existing `match_id` key in API output even though the model
    # field is now a real FK named `match` (attname `match_id`).
    match_id = serializers.IntegerField(read_only=True)
    repost_of = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'content', 'post_type', 'match_id',
            'repost_of', 'reactions_count', 'reposts_count',
            'user_reaction', 'match_card', 'media', 'media_state',
            'created_at', 'updated_at',
        ]

    def get_reactions_count(self, obj):
        return obj.reactions.count()

    def get_reposts_count(self, obj):
        return obj.reposts.count()

    def get_user_reaction(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            reaction = obj.reactions.filter(user=request.user).first()
            return reaction.reaction_type if reaction else None
        return None

    def get_match_card(self, obj):
        # For match_object recap posts, the score + goal-scorer names are
        # DERIVED here from the linked Match and its MatchEvent rows (CLAUDE.md
        # 36.2 — nothing is stored on the Post). Iterating the prefetched
        # events in Python (rather than .filter()) reuses the match__events
        # prefetch and avoids an N+1 across the feed.
        if obj.post_type == 'match_object' and obj.match_id and obj.match:
            from matches.serializers import MatchCardSerializer
            card = dict(MatchCardSerializer(obj.match).data)
            card['goal_scorers'] = [
                {
                    'team': e.team,
                    'player': e.player,
                    'minute': e.minute,
                    'assist': e.assist_player,
                    'detail': e.detail,
                }
                for e in obj.match.events.all()
                if e.event_type == 'goal' and 'Missed' not in (e.detail or '')
            ]
            return card
        return None


class PostCreateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True, max_length=500)
    # Accept/emit `match_id` in the request body while writing to the FK.
    # PrimaryKeyRelatedField also validates the Match exists (replacing the old
    # manual validate_match_id existence check).
    match_id = serializers.PrimaryKeyRelatedField(
        queryset=Match.objects.all(), source='match',
        required=False, allow_null=True,
    )

    class Meta:
        model = Post
        fields = ['id', 'content', 'post_type', 'match_id', 'repost_of']

    def validate(self, data):
        post_type = data.get('post_type')
        if post_type == 'match_object' and not data.get('match'):
            raise serializers.ValidationError('match_id is required for match_object posts.')
        return data

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
