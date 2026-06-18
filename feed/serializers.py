from rest_framework import serializers
from .models import Post, Reaction, Poll, PollOption, PollVote
from users.serializers import UserSerializer


class PollOptionSerializer(serializers.ModelSerializer):
    votes_count = serializers.SerializerMethodField()

    class Meta:
        model = PollOption
        fields = ['id', 'text', 'votes_count']

    def get_votes_count(self, obj):
        return obj.votes.count()


class PollSerializer(serializers.ModelSerializer):
    options = PollOptionSerializer(many=True, read_only=True)

    class Meta:
        model = Poll
        fields = ['id', 'question', 'options', 'created_at']


class ReactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reaction
        fields = ['id', 'user', 'reaction_type', 'created_at']


class PostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    reactions_count = serializers.SerializerMethodField()
    reposts_count = serializers.SerializerMethodField()
    poll = PollSerializer(read_only=True)
    user_reaction = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'content', 'post_type', 'match_id',
            'repost_of', 'reactions_count', 'reposts_count',
            'poll', 'user_reaction', 'created_at', 'updated_at'
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


class PostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ['id', 'content', 'post_type', 'match_id', 'repost_of']

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)