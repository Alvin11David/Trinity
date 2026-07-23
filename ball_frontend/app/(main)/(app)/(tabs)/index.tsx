import { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter, type Href } from 'expo-router';
import type { DrawerActionHelpers } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../../src/store/authStore';
import { useFollowingFeed, useForYouFeed } from '../../../../src/hooks/useFeed';
import { getMatchesByDate } from '../../../../src/api/matches';
import type { Match } from '../../../../src/api/leagueDetail';
import { FeedList } from '../../../../src/components/feed/FeedList';
import { RepostSheet } from '../../../../src/components/feed/RepostSheet';
import type { Post } from '../../../../src/api/feed';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type Tab = 'forYou' | 'following' | 'global';

function TabButton({ label, active, onPress, c }: { label: string; active: boolean; onPress: () => void; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: active ? c.primary : 'transparent' }} hitSlop={8}>
      <Text style={{ fontSize: 14, fontWeight: active ? '700' : '500', color: active ? c.text : c.muted }}>{label}</Text>
    </Pressable>
  );
}

function InlineComposeBar({ onPress, c }: { onPress: () => void; c: ReturnType<typeof useThemeColors> }) {
  const user = useAuthStore((s) => s.user);
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12,
        marginHorizontal: 16, marginBottom: 8, borderRadius: 12,
        backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
      }}
      hitSlop={8}
    >
      {user?.avatar ? (
        <Image source={{ uri: user.avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{(user?.username ?? '?').charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={{ flex: 1, fontSize: 14, color: c.muted }}>What's on your mind about football?</Text>
      <Ionicons name="image-outline" size={18} color={c.muted} />
    </Pressable>
  );
}

function LiveMatchBanner({ match, c }: { match: Match; c: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  const minute = match.minute ?? 0;
  const isLive = match.status === 'live' || match.status === '1H' || match.status === '2H' || match.status === 'HT';
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/match/${match.id}` as Href)}
      style={{
        marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 12,
        backgroundColor: c.isDark ? '#450a0a22' : '#fef2f2',
        borderWidth: 1, borderColor: c.isDark ? '#ef444433' : '#fecaca',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}
      hitSlop={8}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>Live</Text>
        <Text style={{ fontSize: 11, color: c.muted }}>· {minute}'</Text>
      </View>
      <Text style={{ fontSize: 11, fontWeight: '500', color: c.muted }}>{match.league_name}</Text>
    </Pressable>
  );
}

function useLiveMatches() {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const currentSeason = new Date().getFullYear();
  return useQuery({
    queryKey: ['liveMatches', today, currentSeason],
    queryFn: () => getMatchesByDate(today, currentSeason),
    refetchInterval: 60000,
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerActionHelpers<any>>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>('forYou');
  const [repostTarget, setRepostTarget] = useState<Post | null>(null);
  const c = useThemeColors();

  const forYou = useForYouFeed();
  const following = useFollowingFeed();
  const global = useForYouFeed();
  const active = tab === 'forYou' ? forYou : tab === 'following' ? following : global;
  const posts = active.data?.pages.flatMap((p) => p.results);
  const { data: todayMatches } = useLiveMatches();
  const liveMatch = useMemo(() => {
    if (!todayMatches) return null;
    return todayMatches.find((m) => m.status === 'live' || m.status === '1H' || m.status === '2H' || m.status === 'HT') ?? null;
  }, [todayMatches]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* Tabs - Trinity style: sticky at top */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border }}>
        <TabButton label="For You" active={tab === 'forYou'} onPress={() => setTab('forYou')} c={c} />
        <TabButton label="Following" active={tab === 'following'} onPress={() => setTab('following')} c={c} />
        <TabButton label="Global" active={tab === 'global'} onPress={() => setTab('global')} c={c} />
      </View>

      {/* Live banner */}
      {liveMatch && <LiveMatchBanner match={liveMatch} c={c} />}

      {/* Compose */}
      <InlineComposeBar onPress={() => router.push('/(main)/(app)/compose' as Href)} c={c} />

      {/* Feed */}
      <FeedList
        posts={posts}
        isLoading={active.isLoading}
        isRefetching={active.isRefetching}
        onRefresh={active.refetch}
        onRepost={setRepostTarget}
        onEndReached={() => { if (active.hasNextPage && !active.isFetchingNextPage) active.fetchNextPage(); }}
        isFetchingNextPage={active.isFetchingNextPage}
        emptyText={tab === 'following' ? 'Follow people and leagues to fill your feed.' : 'No posts to show yet.'}
      />
      <RepostSheet post={repostTarget} onClose={() => setRepostTarget(null)} />
    </View>
  );
}
