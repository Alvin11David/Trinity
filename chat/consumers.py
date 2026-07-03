import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Conversation, Message, Membership
from users.models import User


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group_name = f'chat_{self.conversation_id}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        is_member = await self.check_membership()
        if not is_member:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type', 'text')
        content = data.get('content', '')
        match_id = data.get('match_id', None)
        metadata = data.get('metadata', None)

        # Check broadcast channel permissions
        can_send = await self.check_send_permission()
        if not can_send:
            await self.send(text_data=json.dumps({
                'error': 'Only admins can post in broadcast channels.'
            }))
            return

        message = await self.save_message(content, message_type, match_id, metadata)

        # save_message returns None when match_card validation fails
        if message is None:
            await self.send(text_data=json.dumps({
                'error': 'Invalid match_id — no matching Match found.'
            }))
            return

        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message_id': message['id'],
                'content': message['content'],
                'message_type': message['message_type'],
                'match_id': message['match_id'],
                'metadata': message['metadata'],
                'sender_id': self.user.id,
                'sender_username': self.user.username,
                'sender_avatar': self.user.avatar,
                'created_at': message['created_at'],
            }
        )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def check_membership(self):
        return Membership.objects.filter(
            user=self.user,
            conversation_id=self.conversation_id
        ).exists()

    @database_sync_to_async
    def check_send_permission(self):
        try:
            conversation = Conversation.objects.get(pk=self.conversation_id)
            if conversation.conversation_type == 'channel' and conversation.channel_mode == 'broadcast':
                membership = Membership.objects.filter(
                    user=self.user,
                    conversation=conversation
                ).first()
                return membership and membership.role == 'admin'
            return True
        except Conversation.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, content, message_type, match_id, metadata):
        # Validate match_card references a real Match before persisting.
        # Runs in sync context, so the error is surfaced by receive() via self.send().
        if message_type == 'match_card':
            from matches.models import validate_match_id
            if not match_id or not validate_match_id(match_id):
                return None
        message = Message.objects.create(
            conversation_id=self.conversation_id,
            sender=self.user,
            content=content,
            message_type=message_type,
            match_id=match_id,
            metadata=metadata
        )
        Conversation.objects.filter(pk=self.conversation_id).update(
            updated_at=message.created_at
        )
        return {
            'id': message.id,
            'content': message.content,
            'message_type': message.message_type,
            'match_id': message.match_id,
            'metadata': message.metadata,
            'created_at': str(message.created_at),
        }