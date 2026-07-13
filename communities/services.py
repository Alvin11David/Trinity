"""
Community ↔ companion-channel membership sync (CommunityRoom).

Voluntary membership syncs bidirectionally: joining a Community also joins its
linked Conversation (if a CommunityRoom exists), and joining that channel
directly also joins the Community — same for voluntarily leaving, both ways.

Kicks are ASYMMETRIC, matching where the authority lives: a community
moderator's kick cascades to channel-membership removal (the community is the
parent space), but a channel admin's kick stays channel-scoped and never
touches CommunityMembership — channel admins hold no community authority
(roles aren't synced, so neither is role-derived power).

Roles are deliberately NOT synced: a community moderator is not automatically a
channel admin, and vice versa. Only membership (being present at all) syncs.

These helpers are called explicitly from the join/leave/kick views (not
signals), so there's no mutual-trigger recursion: each caller writes the other
side's membership row directly and stops.
"""


def sync_membership_to_channel(user, community, joined):
    """Called from the communities side (JoinCommunityView). Mirrors the
    user's community membership onto the linked channel, if one exists."""
    room = getattr(community, 'room', None)
    if room is None:
        return
    from chat.models import Membership
    if joined:
        Membership.objects.get_or_create(
            user=user, conversation=room.conversation,
            defaults={'role': 'member'},
        )
    else:
        Membership.objects.filter(user=user, conversation=room.conversation).delete()


def sync_membership_to_community(user, conversation, joined):
    """Called from the chat side (JoinChannelView / LeaveConversationView).
    Mirrors the user's channel membership onto the linked community, if this
    conversation is a community's companion channel."""
    room = getattr(conversation, 'community_room', None)
    if room is None:
        return
    from .models import CommunityMembership
    if joined:
        CommunityMembership.objects.get_or_create(
            user=user, community=room.community,
            defaults={'role': 'member'},
        )
    else:
        CommunityMembership.objects.filter(user=user, community=room.community).delete()
