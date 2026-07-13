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
        """Strict type-dispatch — every payload must carry an explicit event
        type; there is no implicit-message fallback (the pre-dispatch contract
        was removed before any client existed). Events:
          - {'type': 'typing', 'is_typing': bool} — ephemeral, never persisted
          - {'type': 'message', 'message_type': 'text'|..., 'content', ...}
            — a message send; message_type defaults to 'text'
        Anything else (missing/unknown type, malformed JSON) gets an error
        frame back and is dropped, never persisted.
        """
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({'error': 'Malformed JSON.'}))
            return
        event_kind = data.get('type')

        if event_kind == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'typing_indicator',
                    'user_id': self.user.id,
                    'username': self.user.username,
                    'is_typing': bool(data.get('is_typing', True)),
                }
            )
            return

        if event_kind != 'message':
            await self.send(text_data=json.dumps({
                'error': "Unknown event type — expected 'message' or 'typing'."
            }))
            return

        message_type = data.get('message_type', 'text')
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

        message, error = await self.save_message(content, message_type, match_id, metadata)

        if error:
            await self.send(text_data=json.dumps({'error': error}))
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

    async def typing_indicator(self, event):
        # Ephemeral relay — clients filter out their own user_id and auto-expire
        # the indicator after a few seconds of silence.
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
        # Reject out-of-choices message_type before anything else — Django
        # doesn't enforce `choices` at the DB level and .create() skips model
        # validation, so without this an unknown type would persist as a junk
        # row. (The REST path gets this for free from DRF's ChoiceField.)
        if message_type not in dict(Message.MESSAGE_TYPES):
            return None, f"Unknown message_type '{message_type}'."
        # Shared typed-message validation (match_card/prediction_card/poll +
        # the match-room surface restriction) — same helper the REST serializer
        # uses, so the two paths can't drift. The conversation is loaded so the
        # match-room check has something to inspect. Returns
        # (message_dict, error_string); exactly one is non-None.
        from .validators import validate_message_payload
        conversation = Conversation.objects.get(pk=self.conversation_id)
        error = validate_message_payload(
            message_type, match_id=match_id, metadata=metadata, conversation=conversation
        )
        if error:
            return None, error
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
        }, None