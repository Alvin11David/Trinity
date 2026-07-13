from rest_framework import serializers
from .models import Conversation, Message, Membership
from users.serializers import UserSerializer
from users.models import Contact, Follow


class MembershipSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'role', 'joined_at', 'last_read_at']


class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    match_card = serializers.SerializerMethodField()
    prediction_card = serializers.SerializerMethodField()
    poll = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            'id', 'conversation', 'sender', 'content',
            'message_type', 'match_id', 'metadata',
            'match_card', 'prediction_card', 'poll',
            'is_read', 'created_at'
        ]

    def get_match_card(self, obj):
        if obj.message_type == 'match_card' and obj.match_id:
            from matches.models import Match
            from matches.serializers import MatchCardSerializer
            match = Match.objects.filter(id=obj.match_id).first()
            if match:
                return MatchCardSerializer(match).data
        return None

    def get_prediction_card(self, obj):
        # Mirrors match_card: pulls the live Match + its Winnie prediction for
        # rendering, rather than snapshotting the prediction onto the message.
        if obj.message_type == 'prediction_card' and obj.match_id:
            from matches.models import Match
            from matches.serializers import MatchCardSerializer
            match = Match.objects.filter(id=obj.match_id).first()
            if match:
                return {
                    'match': MatchCardSerializer(match).data,
                    'prediction': match.winnie_prediction,
                }
        return None

    def get_poll(self, obj):
        if obj.message_type != 'poll':
            return None
        options = (obj.metadata or {}).get('options') or []
        from .models import MessagePollVote
        votes = list(MessagePollVote.objects.filter(message=obj))
        counts = [0] * len(options)
        for v in votes:
            if 0 <= v.option_index < len(options):
                counts[v.option_index] += 1
        user_vote = None
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            mine = next((v for v in votes if v.user_id == request.user.id), None)
            user_vote = mine.option_index if mine else None
        return {
            'options': options,
            'counts': counts,
            'total_votes': len(votes),
            'user_vote': user_vote,
        }

    def validate(self, data):
        from .validators import validate_message_payload
        error = validate_message_payload(
            data.get('message_type', 'text'),
            match_id=data.get('match_id'),
            metadata=data.get('metadata'),
        )
        if error:
            raise serializers.ValidationError(error)
        return data


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
        # Uses the viewer's Membership.last_read_at (works for DMs and groups),
        # superseding the deprecated per-message Message.is_read flag.
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            membership = obj.memberships.filter(user=request.user).first()
            qs = obj.messages.exclude(sender=request.user)
            if membership and membership.last_read_at:
                qs = qs.filter(created_at__gt=membership.last_read_at)
            return qs.count()
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

        # is_public is a channel-only concept — reject it for direct/group so a
        # "private" group can't silently be flagged public.
        if data.get('is_public') and conversation_type != 'channel':
            raise serializers.ValidationError(
                'Only channels can be public.'
            )

        # Groups and channels are named spaces; direct messages are named by the
        # other participant, so they don't need one.
        if conversation_type in ('group', 'channel') and not (data.get('name') or '').strip():
            raise serializers.ValidationError(
                f'A {conversation_type} requires a name.'
            )

        if conversation_type == 'group':
            # Creator + at least one other = a real group, not a glorified DM.
            if len(participant_ids) < 1:
                raise serializers.ValidationError(
                    'A group requires at least 2 participants (you and one other).'
                )

        if conversation_type == 'direct':
            if len(participant_ids) != 1:
                raise serializers.ValidationError('Direct messages require exactly one other participant.')

            from users.models import User
            try:
                target = User.objects.get(pk=participant_ids[0])
            except User.DoesNotExist:
                raise serializers.ValidationError('Target user not found.')

            # DMs require a mutual relationship: either a synced mutual contact
            # (inherently two-way), or a mutual follow (both directions must
            # exist — a one-way follow is no longer sufficient).
            mutual_contacts = are_mutual_contacts(request.user, target)
            mutual_follow = (
                Follow.objects.filter(follower=request.user, following=target).exists()
                and Follow.objects.filter(follower=target, following=request.user).exists()
            )

            if not mutual_contacts and not mutual_follow:
                raise serializers.ValidationError(
                    'You can only message users who follow you back, or who have '
                    'your contact saved mutually.'
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
        # Channels default to 'open' when the creator doesn't specify a mode, so
        # new channels are self-documenting (None and 'open' behave identically,
        # but writing it explicitly avoids ambiguity going forward). channel_mode
        # stays meaningless (and untouched) for direct/group.
        if validated_data.get('conversation_type') == 'channel' and not validated_data.get('channel_mode'):
            validated_data['channel_mode'] = 'open'
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
