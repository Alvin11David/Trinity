from rest_framework import serializers
from .models import Conversation, Message, Membership
from users.serializers import UserSerializer
from users.models import Contact, Follow


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'role', 'joined_at']


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    match_card = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'content',
            'message_type', 'match_id', 'metadata',
            'match_card', 'is_read', 'created_at'
        ]

    def get_match_card(self, obj):
        if obj.message_type == 'match_card' and obj.match_id:
            from matches.models import Match
            from matches.serializers import MatchCardSerializer
            match = Match.objects.filter(id=obj.match_id).first()
            if match:
                return MatchCardSerializer(match).data
        return None


class ConversationSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    membership = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'conversation_type', 'channel_mode', 'name',
            'description', 'avatar', 'is_public', 'participants',
            'last_message', 'unread_count', 'membership', 'created_at', 'updated_at'
        ]

    def get_last_message(self, obj):
        last = obj.messages.last()
        return MessageSerializer(last).data if last else None

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.messages.filter(is_read=False).exclude(sender=request.user).count()
        return 0

    def get_membership(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(user=request.user).first()
            return MembershipSerializer(membership).data if membership else None
        return None


def are_mutual_contacts(user_a, user_b):
    a_has_b = Contact.objects.filter(user=user_a, matched_user=user_b).exists()
    b_has_a = Contact.objects.filter(user=user_b, matched_user=user_a).exists()
    return a_has_b and b_has_a


class ConversationCreateSerializer(serializers.ModelSerializer):
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True
    )

    class Meta:
        model = Conversation
        fields = [
            'id', 'conversation_type', 'channel_mode',
            'name', 'description', 'is_public', 'participant_ids'
        ]

    def validate(self, data):
        request = self.context['request']
        conversation_type = data.get('conversation_type', 'direct')
        participant_ids = data.get('participant_ids', [])

        if conversation_type == 'direct':
            if len(participant_ids) != 1:
                raise serializers.ValidationError('Direct messages require exactly one other participant.')

            from users.models import User
            try:
                target = User.objects.get(pk=participant_ids[0])
            except User.DoesNotExist:
                raise serializers.ValidationError('Target user not found.')

            mutual = are_mutual_contacts(request.user, target)
            i_follow_them = Follow.objects.filter(follower=request.user, following=target).exists()

            if not mutual and not i_follow_them:
                raise serializers.ValidationError(
                    'You can only message users you follow, or users who have your contact saved mutually.'
                )

            existing = Conversation.objects.filter(
                conversation_type='direct',
                participants=request.user
            ).filter(participants=target).first()
            if existing:
                data['_existing_conversation'] = existing

        return data

    def create(self, validated_data):
        existing = validated_data.pop('_existing_conversation', None)
        if existing:
            return existing

        participant_ids = validated_data.pop('participant_ids')
        request = self.context['request']
        conversation = Conversation.objects.create(**validated_data)
        Membership.objects.create(user=request.user, conversation=conversation, role='admin')
        for user_id in participant_ids:
            if user_id != request.user.id:
                Membership.objects.create(
                    user_id=user_id,
                    conversation=conversation,
                    role='member'
                )
        return conversation
