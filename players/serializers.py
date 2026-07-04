from rest_framework import serializers
from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = [
            'id', 'api_football_id', 'team_id', 'team_name', 'name',
            'first_name', 'last_name', 'age', 'number', 'position', 'photo',
            'nationality', 'birth_date', 'birth_place', 'height', 'weight',
            'injured', 'statistics', 'updated_at'
        ]
