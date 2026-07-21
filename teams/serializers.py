from rest_framework import serializers
from .models import Team


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = [
            'api_football_id', 'name', 'code', 'country', 'founded', 'national',
            'logo', 'venue_name', 'venue_city', 'venue_capacity',
            'transfermarkt_id', 'squad_value_eur', 'transfer_balance_eur',
            'match_confidence', 'tm_synced_at', 'updated_at',
        ]
