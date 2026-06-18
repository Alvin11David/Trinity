from rest_framework import serializers
from .models import Conversation, Message, Membership
from users.serializers import UserSerializer


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'role', 'joined_at']


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'content',
            'message_type', 'match_id', 'metadata',
            'is_read', 'created_at'
        ]


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

    def create(self, validated_data):
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