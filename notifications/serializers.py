from rest_framework import serializers
from .models import Notification, FCMToken
from users.serializers import UserSerializer


class NotificationSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'sender', 'notification_type', 'title',
            'body', 'match_id', 'post_id', 'community_id',
            'is_read', 'created_at'
        ]


class FCMTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = FCMToken
        fields = ['id', 'token', 'device_type', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        token, _ = FCMToken.objects.update_or_create(
            token=validated_data['token'],
            defaults=validated_data
        )
        return token