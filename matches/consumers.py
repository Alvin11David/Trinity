import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import Match


class MatchConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.match_id = self.scope['url_route']['kwargs']['match_id']
        self.room_group_name = f'match_{self.match_id}'
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

        # Send current match state on connect
        match_data = await self.get_match_data()
        if match_data:
            await self.send(text_data=json.dumps({
                'type': 'match_state',
                'match': match_data
            }))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        pass

    async def match_update(self, event):
        await self.send(text_data=json.dumps(event))

    async def match_event(self, event):
        await self.send(text_data=json.dumps(event))

    @database_sync_to_async
    def get_match_data(self):
        try:
            match = Match.objects.get(pk=self.match_id)
            return {
                'id': match.id,
                'home_team': match.home_team,
                'away_team': match.away_team,
                'home_score': match.home_score,
                'away_score': match.away_score,
                'status': match.status,
                'minute': match.minute,
                'live_stats': match.live_stats,
                'winnie_prediction': match.winnie_prediction,
            }
        except Match.DoesNotExist:
            return None