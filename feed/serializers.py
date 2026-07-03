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
    match_card = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            'id', 'author', 'content', 'post_type', 'match_id',
            'repost_of', 'reactions_count', 'reposts_count',
            'poll', 'user_reaction', 'match_card', 'created_at', 'updated_at'
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
        if obj.post_type == 'match_object' and obj.match_id:
            from matches.models import Match
            from matches.serializers import MatchCardSerializer
            match = Match.objects.filter(id=obj.match_id).first()
            if match:
                return MatchCardSerializer(match).data
        return None


class PostCreateSerializer(serializers.ModelSerializer):
    content = serializers.CharField(required=False, allow_blank=True, max_length=500)

    class Meta:
        model = Post
        fields = ['id', 'content', 'post_type', 'match_id', 'repost_of']

    def validate(self, data):
        if data.get('post_type') == 'match_object':
            match_id = data.get('match_id')
            if not match_id:
                raise serializers.ValidationError('match_id is required for match_object posts.')
            from matches.models import validate_match_id
            if not validate_match_id(match_id):
                raise serializers.ValidationError('Invalid match_id — no matching Match found.')
        return data

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)