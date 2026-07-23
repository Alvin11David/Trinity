import { useState } from 'react';
import { View, Text, Pressable, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../../../../src/hooks/useNotifications';
import { useNewFollowers, useSuggestedPeople, useFollowPerson } from '../../../../src/hooks/usePeople';
import { notificationMeta } from '../../../../src/lib/notificationMeta';
import { timeAgo } from '../../../../src/lib/time';
import type { AppNotification } from '../../../../src/api/notifications';
import type { PostAuthor } from '../../../../src/api/feed';
import { reasonLabel, type SuggestedPerson } from '../../../../src/api/people';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type Segment = 'notifications' | 'people';
type NotifFilter = 'all' | 'mentions' | 'social' | 'match_alerts';

const NOTIF_FILTERS: { key: NotifFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'social', label: 'Social' },
  { key: 'match_alerts', label: 'Match Alerts' },
];

function matchesFilter(n: AppNotification, filter: NotifFilter): boolean {
  if (filter === 'all') return true;
  const t = n.notification_type;
  if (filter === 'mentions') return t === 'mention' || t === 'reply';
  if (filter === 'social') return (['follow', 'reaction', 'repost', 'community_post'] as string[]).includes(t);
  if (filter === 'match_alerts') return (['goal', 'kickoff', 'card', 'substitution', 'match_result', 'winnie_alert'] as string[]).includes(t);
  return true;
}

function targetHref(n: AppNotification): Href | null {
  if (n.post_id) return `/(main)/(app)/post/${n.post_id}` as Href;
  if (n.match_id) return `/(main)/(app)/match/${n.match_id}` as Href;
  if ((n.notification_type === 'follow' || n.notification_type === 'mention') && n.sender?.username) return `/(main)/(app)/profile/${n.sender.username}` as Href;
  return null;
}

const TYPE_COLORS: Record<string, { bg: string; icon: string }> = {
  goal: { bg: '#dcfce7', icon: '#16a34a' },
  kickoff: { bg: '#dbeafe', icon: '#3b82f6' },
  follow: { bg: '#f3e8ff', icon: '#a855f7' },
  reaction: { bg: '#fef9c3', icon: '#eab308' },
  reply: { bg: '#dcfce7', icon: '#16a34a' },
  repost: { bg: '#e0f2fe', icon: '#0ea5e9' },
  winnie_alert: { bg: '#e0e7ff', icon: '#6366f1' },
  community_post: { bg: '#ffedd5', icon: '#f97316' },
  match_result: { bg: '#dcfce7', icon: '#16a34a' },
  mention: { bg: '#fce7f3', icon: '#ec4899' },
  card: { bg: '#fef9c3', icon: '#eab308' },
  substitution: { bg: '#dbeafe', icon: '#3b82f6' },
};

function NotificationRow({ n, onPress, c }: { n: AppNotification; onPress: (n: AppNotification) => void; c: ReturnType<typeof useThemeColors> }) {
  const meta = notificationMeta(n.notification_type);
  const tc = TYPE_COLORS[n.notification_type] || TYPE_COLORS.goal;
  return (
    <Pressable
      onPress={() => onPress(n)}
      style={{
        flexDirection: 'row', gap: 14, paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: c.border,
        backgroundColor: n.is_read ? 'transparent' : (c.isDark ? '#052e1620' : '#f0fdf480'),
      }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.isDark ? tc.bg + '20' : tc.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={meta.icon} size={18} color={tc.icon} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            {n.sender && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {n.sender.avatar && <Image source={{ uri: n.sender.avatar }} style={{ width: 16, height: 16, borderRadius: 8 }} />}
                <Text style={{ fontSize: 11, fontWeight: '600', color: c.muted }}>@{n.sender.username}</Text>
              </View>
            )}
            <Text style={{ fontSize: 14, fontWeight: '600', color: c.text }} numberOfLines={1}>{n.title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            {!n.is_read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />}
            <Text style={{ fontSize: 11, color: c.muted }}>{timeAgo(n.created_at)}</Text>
          </View>
        </View>
        <Text style={{ fontSize: 13, color: c.muted, marginTop: 2, lineHeight: 18 }} numberOfLines={2}>{n.body}</Text>
      </View>
    </Pressable>
  );
}

function NotificationsSegment({ c }: { c: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [activeFilter, setActiveFilter] = useState<NotifFilter>('all');
  const filtered = (data ?? []).filter((n) => matchesFilter(n, activeFilter));

  const onPress = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const href = targetHref(n);
    if (href) router.push(href);
  };

  if (isLoading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.primary} /></View>;

  return (
    <View style={{ flex: 1 }}>
      {/* Mark all read */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => markAll.mutate()} hitSlop={8}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: c.primary }}>Mark all read</Text>
        </Pressable>
      </View>

      {/* Tabs - Trinity style: underline */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, overflow: 'scroll' }}>
        {NOTIF_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setActiveFilter(f.key)}
            style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: activeFilter === f.key ? c.primary : 'transparent' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: activeFilter === f.key ? c.primary : c.muted }}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(n) => String(n.id)}
        renderItem={({ item }) => <NotificationRow n={item} onPress={onPress} c={c} />}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} colors={[c.primary]} />}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
            <Ionicons name="notifications-off-outline" size={36} color={c.gray300} />
            <Text style={{ fontWeight: '600', color: c.muted, marginTop: 12 }}>No notifications here</Text>
          </View>
        }
      />
    </View>
  );
}

function PersonRow({ user, actionLabel, reason, onAction, onDismiss, pending, c }: {
  user: PostAuthor; actionLabel: string; reason?: string; onAction: () => void; onDismiss: () => void; pending: boolean; c: ReturnType<typeof useThemeColors>;
}) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <Pressable onPress={() => router.push(`/(main)/(app)/profile/${user.username}` as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '600', color: c.muted }}>{user.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', fontSize: 15, color: c.text }} numberOfLines={1}>
            {[user.first_name, user.last_name].filter(Boolean).join(' ') || user.username}
          </Text>
          <Text style={{ fontSize: 12, color: c.muted }} numberOfLines={1}>@{user.username}</Text>
          {!!reason && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start', backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Ionicons name="people-outline" size={11} color={c.muted} />
              <Text style={{ fontSize: 11, color: c.muted }}>{reason}</Text>
            </View>
          )}
        </View>
      </Pressable>
      <Pressable onPress={onAction} disabled={pending} style={{ borderRadius: 999, backgroundColor: c.primary, paddingHorizontal: 16, paddingVertical: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>{actionLabel}</Text>
      </Pressable>
      <Pressable onPress={onDismiss} hitSlop={8} style={{ paddingLeft: 4 }}>
        <Ionicons name="close" size={18} color={c.muted} />
      </Pressable>
    </View>
  );
}

function PeopleSegment({ c }: { c: ReturnType<typeof useThemeColors> }) {
  const followers = useNewFollowers();
  const suggestions = useSuggestedPeople();
  const follow = useFollowPerson();
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const hide = (id: number) => setDismissed((prev) => new Set(prev).add(id));
  const loading = followers.isLoading || suggestions.isLoading;
  const followerList = (followers.data ?? []).filter((u) => !dismissed.has(u.id));
  const suggestionList = (suggestions.data ?? []).filter((s: SuggestedPerson) => !dismissed.has(s.user.id));

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={c.primary} /></View>;
  if (followerList.length === 0 && suggestionList.length === 0) {
    return <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 96 }}><Ionicons name="people-outline" size={32} color={c.gray300} /><Text style={{ fontSize: 14, color: c.muted, marginTop: 12, textAlign: 'center' }}>No new followers or suggestions right now.</Text></View>;
  }

  return (
    <FlatList
      data={[...followerList.map((u) => ({ type: 'follower' as const, data: u })), ...suggestionList.map((s) => ({ type: 'suggestion' as const, data: s }))]}
      keyExtractor={(item) => item.type === 'follower' ? `f-${item.data.id}` : `s-${item.data.user.id}`}
      renderItem={({ item }) => {
        if (item.type === 'follower') {
          return <PersonRow user={item.data} actionLabel="Follow back" onAction={() => follow.mutate(item.data.username)} onDismiss={() => hide(item.data.id)} pending={follow.isPending && follow.variables === item.data.username} c={c} />;
        }
        return <PersonRow user={item.data.user} actionLabel="Follow" reason={item.data.reasons[0] ? reasonLabel(item.data.reasons[0]) : undefined} onAction={() => follow.mutate(item.data.user.username)} onDismiss={() => hide(item.data.user.id)} pending={follow.isPending && follow.variables === item.data.user.username} c={c} />;
      }}
    />
  );
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const [segment, setSegment] = useState<Segment>('notifications');
  const c = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* Header - Trinity style */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>Notifications</Text>
      </View>

      {/* Segment tabs - Trinity style: underline */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border }}>
        {(['notifications', 'people'] as const).map((s) => (
          <Pressable key={s} onPress={() => setSegment(s)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: segment === s ? c.primary : 'transparent' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: segment === s ? c.primary : c.muted }}>
              {s === 'notifications' ? 'Notifications' : 'People'}
            </Text>
          </Pressable>
        ))}
      </View>

      {segment === 'notifications' ? <NotificationsSegment c={c} /> : <PeopleSegment c={c} />}
    </View>
  );
}
