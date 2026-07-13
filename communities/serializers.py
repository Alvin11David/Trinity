from rest_framework import serializers
from .models import Community, CommunityMembership, CommunityPost, CommunityPostVote
from users.serializers import UserSerializer


class CommunitySerializer(serializers.ModelSerializer):
    members_count = serializers.SerializerMethodField()
    is_member = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Community
        fields = [
            'id', 'name', 'description', 'avatar', 'banner',
            'is_official', 'members_count', 'is_member',
            'user_role', 'created_at'
        ]

    def get_members_count(self, obj):
        return obj.members.count()

    def get_is_member(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.memberships.filter(user=request.user).exists()
        return False

    def get_user_role(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(user=request.user).first()
            return membership.role if membership else None
        return None


class CommunityPostSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    upvotes = serializers.SerializerMethodField()
    downvotes = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = CommunityPost
        fields = [
            'id', 'community', 'author', 'content', 'post_type', 'match_id',
            'is_pinned', 'upvotes', 'downvotes', 'user_vote', 'created_at'
        ]

    def get_upvotes(self, obj):
        return obj.votes.filter(vote_type='up').count()

    def get_downvotes(self, obj):
        return obj.votes.filter(vote_type='down').count()

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            vote = obj.votes.filter(user=request.user).first()
            return vote.vote_type if vote else None
        return None


class CommunityPostCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityPost
        fields = ['id', 'content', 'post_type', 'match_id']

    def validate(self, data):
        # Same existence check chat.Message applies — a post may only reference
        # a Match that actually exists (match_id=None is fine: no match attached).
        match_id = data.get('match_id')
        from matches.models import validate_match_id
        if not validate_match_id(match_id):
            raise serializers.ValidationError('Invalid match_id — no matching Match found.')
        if data.get('post_type') == 'match_object' and not match_id:
            raise serializers.ValidationError('match_id is required for match_object posts.')
        return data

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        validated_data['community'] = self.context['community']
        return super().create(validated_data)