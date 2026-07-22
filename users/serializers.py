from rest_framework import serializers
from .models import User, Follow, Report
from leagues.models import League


class UserSerializer(serializers.ModelSerializer):
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    # Favorite league denormalized onto the payload (name + logo) so the profile
    # header can render the badge without a second round-trip. Team is already
    # flat on the model.
    favorite_league = serializers.PrimaryKeyRelatedField(read_only=True)
    favorite_league_name = serializers.CharField(source='favorite_league.name', read_only=True, default=None)
    favorite_league_logo = serializers.CharField(source='favorite_league.logo', read_only=True, default=None)
    # Phase 4: favorite team name/logo via the Team FK (denormalized columns drop
    # in Phase 5). favorite_team_id stays (survives the rename).
    favorite_team_name = serializers.CharField(source='favorite_team_ref.name', read_only=True, allow_null=True)
    favorite_team_logo = serializers.CharField(source='favorite_team_ref.logo', read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'favorite_club', 'bio', 'avatar', 'banner', 'followers_count',
            'following_count',
            'favorite_team_id', 'favorite_team_name', 'favorite_team_logo',
            'favorite_league', 'favorite_league_name', 'favorite_league_logo',
            'created_at'
        ]

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    """Edit Profile (Step 6) + favorite team/league + avatar. `favorite_league`
    accepts a League pk (or null to clear); team is written via the two flat
    denormalized fields. All fields optional so a partial PATCH works."""
    favorite_league = serializers.PrimaryKeyRelatedField(
        queryset=League.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = User
        fields = [
            'username', 'bio', 'avatar',
            'favorite_team_id', 'favorite_team_name', 'favorite_team_logo',
            'favorite_league',
        ]
        extra_kwargs = {'username': {'required': False}}

    def update(self, instance, validated_data):
        # Keep the Team FK in sync with the denormalized favorite_team_id during
        # the Phase 3 coexistence window. Only act when the client actually sent
        # favorite_team_id (partial PATCH may omit it).
        if 'favorite_team_id' in validated_data:
            from teams.models import Team
            fid = validated_data.get('favorite_team_id')
            instance.favorite_team_ref = Team.ensure(
                fid,
                validated_data.get('favorite_team_name', ''),
                validated_data.get('favorite_team_logo'),
            ) if fid else None
        return super().update(instance, validated_data)

    def validate_username(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('Username cannot be blank.')
        if User.objects.exclude(pk=self.instance.pk).filter(username__iexact=value).exists():
            raise serializers.ValidationError('That username is taken.')
        return value


class ProfileSerializer(serializers.ModelSerializer):
    """Aggregate profile view (Step 4): identity + counts + the viewer's
    relationship to this user + the pinned post. Everything the frontend needs to
    render the header and the right action-button state in one call."""
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()
    favorite_league = serializers.PrimaryKeyRelatedField(read_only=True)
    favorite_league_name = serializers.CharField(source='favorite_league.name', read_only=True, default=None)
    favorite_league_logo = serializers.CharField(source='favorite_league.logo', read_only=True, default=None)
    # Phase 4: favorite team name/logo via the Team FK (see UserSerializer).
    favorite_team_name = serializers.CharField(source='favorite_team_ref.name', read_only=True, allow_null=True)
    favorite_team_logo = serializers.CharField(source='favorite_team_ref.logo', read_only=True, allow_null=True)
    is_self = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    is_followed_by = serializers.SerializerMethodField()
    is_blocked = serializers.SerializerMethodField()      # viewer → this user
    is_blocked_by = serializers.SerializerMethodField()   # this user → viewer
    pinned_post = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'avatar', 'banner', 'bio',
            'favorite_team_id', 'favorite_team_name', 'favorite_team_logo',
            'favorite_league', 'favorite_league_name', 'favorite_league_logo',
            'followers_count', 'following_count',
            'is_self', 'is_following', 'is_followed_by',
            'is_blocked', 'is_blocked_by', 'pinned_post', 'created_at',
        ]

    def get_followers_count(self, obj):
        return obj.followers.count()

    def get_following_count(self, obj):
        return obj.following.count()

    def _viewer(self):
        request = self.context.get('request')
        return request.user if request and request.user.is_authenticated else None

    def get_is_self(self, obj):
        viewer = self._viewer()
        return bool(viewer and viewer.id == obj.id)

    def get_is_following(self, obj):
        viewer = self._viewer()
        return bool(viewer and Follow.objects.filter(follower=viewer, following=obj).exists())

    def get_is_followed_by(self, obj):
        viewer = self._viewer()
        return bool(viewer and Follow.objects.filter(follower=obj, following=viewer).exists())

    def get_is_blocked(self, obj):
        from .models import Block
        viewer = self._viewer()
        return bool(viewer and Block.objects.filter(blocker=viewer, blocked=obj).exists())

    def get_is_blocked_by(self, obj):
        from .models import Block
        viewer = self._viewer()
        return bool(viewer and Block.objects.filter(blocker=obj, blocked=viewer).exists())

    def get_pinned_post(self, obj):
        if not obj.pinned_post_id:
            return None
        from feed.serializers import PostSerializer
        return PostSerializer(obj.pinned_post, context=self.context).data

    def to_representation(self, obj):
        data = super().to_representation(obj)
        # Full content hide when a block exists in either direction (Step 2):
        # keep only identity (username) + the relationship flags the client needs
        # to render the blocked state and an Unblock affordance. Everything else
        # is masked so nothing leaks over the API.
        if not self.get_is_self(obj) and (data['is_blocked'] or data['is_blocked_by']):
            for field in (
                'first_name', 'last_name', 'avatar', 'banner', 'favorite_league',
                'favorite_league_name', 'favorite_league_logo',
                'favorite_team_name', 'favorite_team_logo',
            ):
                data[field] = None
            data['bio'] = ''
            data['favorite_team_id'] = None
            data['followers_count'] = 0
            data['following_count'] = 0
            data['pinned_post'] = None
        return data


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['id', 'reported_user', 'reason', 'detail', 'created_at']
        # reporter + reported_user are set from the request/URL in ReportView,
        # never from the body — only reason (+ optional detail) come from input.
        read_only_fields = ['id', 'reported_user', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'favorite_club']

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class FollowSerializer(serializers.ModelSerializer):
    class Meta:
        model = Follow
        fields = ['id', 'follower', 'following', 'created_at']


class RequestOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)


class VerifyOTPSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=6)


class ContactSyncSerializer(serializers.Serializer):
    phone_numbers = serializers.ListField(child=serializers.CharField(max_length=20))