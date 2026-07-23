import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  useProfileDetail,
  useProfilePosts,
  useProfileReplies,
  useProfileMedia,
  useProfileReposts,
  useToggleFollow,
  useBlockUser,
  useUnblockUser,
  useReportUser,
  usePinPost,
} from '../../../../src/hooks/useProfile';
import { PostCard } from '../../../../src/components/feed/PostCard';
import { RepostSheet } from '../../../../src/components/feed/RepostSheet';
import { timeAgo } from '../../../../src/lib/time';
import { createConversation } from '../../../../src/api/chat';
import type { ProfileDetail, ProfileReply, ReportReason } from '../../../../src/api/profile';
import type { Post } from '../../../../src/api/feed';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type TabKey = 'posts' | 'replies' | 'media' | 'reposts';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'replies', label: 'Replies' },
  { key: 'media', label: 'Media' },
  { key: 'reposts', label: 'Reposts' },
];

const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'other', label: 'Other' },
];

function displayName(p: { first_name?: string; last_name?: string; username: string }) {
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.username;
}

function ReplyRow({ reply }: { reply: ProfileReply }) {
  const c = useThemeColors();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/post/${reply.post}` as Href)}
      className="px-4 py-3"
      style={{ borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      <Text className="text-xs mb-1" style={{ color: c.muted }}>
        Replying to @{reply.post_author_username}
      </Text>
      <Text className="text-[15px] leading-5" style={{ color: c.text }}>{reply.content}</Text>
      <Text className="text-xs mt-1.5" style={{ color: c.muted }}>{timeAgo(reply.created_at)}</Text>
    </Pressable>
  );
}

// A single tappable favorite chip → deep-links into Search prefilled with the
// name (lands on Top results via the existing FTS — zero new backend).
function FavoriteChip({ label, logo }: { label: string; logo: string | null }) {
  const c = useThemeColors();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/search?q=${encodeURIComponent(label)}` as Href)}
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
      style={{ backgroundColor: c.card }}
    >
      {logo ? (
        <Image source={{ uri: logo }} style={{ width: 16, height: 16 }} contentFit="contain" />
      ) : (
        <Ionicons name="football-outline" size={14} color={c.primary} />
      )}
      <Text className="text-[13px] font-medium" style={{ color: c.text }}>{label}</Text>
    </Pressable>
  );
}

// Team and league are independent optional favorites — render each as its own
// chip (with its own crest) side by side when set, rather than collapsing to one.
function FavoriteBadges({ profile }: { profile: ProfileDetail }) {
  const hasTeam = !!profile.favorite_team_name;
  const hasLeague = !!profile.favorite_league_name;
  if (!hasTeam && !hasLeague) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-2 mt-3">
      {hasTeam && <FavoriteChip label={profile.favorite_team_name} logo={profile.favorite_team_logo} />}
      {hasLeague && <FavoriteChip label={profile.favorite_league_name!} logo={profile.favorite_league_logo} />}
    </View>
  );
}

export default function ProfileScreen() {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  const [tab, setTab] = useState<TabKey>('posts');
  const [repostTarget, setRepostTarget] = useState<Post | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('spam');
  const [reportDetail, setReportDetail] = useState('');

  const profileQ = useProfileDetail(username);
  const profile = profileQ.data;
  const blocked = !!(profile && (profile.is_blocked || profile.is_blocked_by));

  // Only the active tab fetches (and never while blocked).
  const active = (t: TabKey) => tab === t && !blocked;
  const postsQ = useProfilePosts(username, active('posts'));
  const repliesQ = useProfileReplies(username, active('replies'));
  const mediaQ = useProfileMedia(username, active('media'));
  const repostsQ = useProfileReposts(username, active('reposts'));

  const follow = useToggleFollow(username);
  const block = useBlockUser(username);
  const unblock = useUnblockUser(username);
  const report = useReportUser(username);
  const pin = usePinPost(username);

  const onMessage = async () => {
    if (!profile) return;
    if (blocked) {
      Alert.alert('Unavailable', 'You can no longer message this user.');
      return;
    }
    try {
      const convo = await createConversation({
        conversation_type: 'direct',
        participant_ids: [profile.id],
      });
      router.push(`/(main)/(app)/chat/${convo.id}` as Href);
    } catch (e: any) {
      const detail = e?.response?.data;
      const msg = Array.isArray(detail) ? detail[0] : detail?.detail || 'You cannot message this user yet.';
      Alert.alert('Cannot message', String(msg));
    }
  };

  const confirmBlock = () => {
    setMenuOpen(false);
    Alert.alert(
      `Block @${username}?`,
      "They won't be able to message you, and you won't see each other's posts. " +
        'Any follows between you will be removed. You can unblock later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => block.mutate() },
      ],
    );
  };

  const submitReport = () => {
    report.mutate(
      { reason: reportReason, detail: reportDetail.trim() },
      {
        onSuccess: () => {
          setReportOpen(false);
          setReportDetail('');
          Alert.alert('Report received', 'Thanks — our team will review this.');
        },
        onError: () => Alert.alert('Could not submit', 'Please try again.'),
      },
    );
  };

  const onPinToggle = (post: Post) => {
    const isPinned = profile?.pinned_post?.id === post.id;
    Alert.alert(
      isPinned ? 'Unpin post?' : 'Pin to profile?',
      isPinned
        ? 'This post will no longer appear at the top of your profile.'
        : 'This post will show at the top of your profile, replacing any current pin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isPinned ? 'Unpin' : 'Pin',
          onPress: () => pin.mutate({ postId: isPinned ? null : post.id }),
        },
      ],
    );
  };

  // ---- Header (scrolls with the list) ----
  const Header = () => {
    if (!profile) return null;
    return (
      <View>
        {/* Banner — X-style header image (hidden/masked when blocked). */}
        {!blocked &&
          (profile.banner ? (
            <Image source={{ uri: profile.banner }} style={{ width: '100%', height: 130 }} contentFit="cover" />
          ) : (
            <View style={{ height: 130, backgroundColor: c.card }} />
          ))}

        <View className="px-4" style={{ paddingTop: blocked ? 12 : 0 }}>
          {/* Avatar overlaps the banner's lower edge; action row sits to its right. */}
          <View className="flex-row items-end justify-between">
            <View style={{ marginTop: blocked ? 0 : -40 }}>
              {profile.avatar ? (
                <Image
                  source={{ uri: profile.avatar }}
                  style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: c.border }}
                />
              ) : (
                <View
                  className="rounded-full items-center justify-center"
                  style={{ width: 80, height: 80, borderWidth: 3, borderColor: c.border, backgroundColor: c.card }}
                >
                  <Text className="text-2xl font-bold" style={{ color: c.muted }}>
                    {displayName(profile).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Action row */}
            {profile.is_self ? (
              <Pressable
                onPress={() => router.push('/(main)/(app)/profile/edit' as Href)}
                className="rounded-full px-4 py-2 mb-1"
                style={{ borderWidth: 1, borderColor: c.border }}
              >
                <Text className="font-semibold text-[13px]" style={{ color: c.text }}>Edit Profile</Text>
              </Pressable>
            ) : !blocked ? (
              <View className="flex-row items-center gap-2 mb-1">
                <Pressable onPress={onMessage} className="rounded-full w-9 h-9 items-center justify-center" style={{ borderWidth: 1, borderColor: c.border }}>
                  <Ionicons name="mail-outline" size={18} color={c.text} />
                </Pressable>
                <Pressable
                  onPress={() => follow.mutate()}
                  disabled={follow.isPending}
                  className={`rounded-full px-5 py-2`}
                  style={profile.is_following ? { borderWidth: 1, borderColor: c.border } : { backgroundColor: c.primary }}
                >
                  <Text className={`font-semibold text-[13px]`} style={{ color: profile.is_following ? c.text : '#fff' }}>
                    {profile.is_following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} className="w-9 h-9 items-center justify-center">
                  <Ionicons name="ellipsis-horizontal" size={20} color={c.text} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <Text className="text-xl font-bold mt-3" style={{ color: c.text }}>{displayName(profile)}</Text>
          <Text className="text-[14px]" style={{ color: c.muted }}>@{profile.username}</Text>

          {profile.is_followed_by && !blocked && (
            <View className="self-start rounded px-1.5 py-0.5 mt-1.5" style={{ backgroundColor: c.card }}>
              <Text className="text-[11px]" style={{ color: c.muted }}>Follows you</Text>
            </View>
          )}

          {!blocked && !!profile.bio && (
            <Text className="text-[14px] leading-5 mt-3" style={{ color: c.text }}>{profile.bio}</Text>
          )}

          {!blocked && <FavoriteBadges profile={profile} />}

          {!blocked && (
            <View className="flex-row gap-5 mt-4">
              <Pressable className="flex-row items-center gap-1">
                <Text className="font-bold text-[14px]" style={{ color: c.text }}>{profile.following_count}</Text>
                <Text className="text-[14px]" style={{ color: c.muted }}>Following</Text>
              </Pressable>
              <Pressable className="flex-row items-center gap-1">
                <Text className="font-bold text-[14px]" style={{ color: c.text }}>{profile.followers_count}</Text>
                <Text className="text-[14px]" style={{ color: c.muted }}>Followers</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Blocked state */}
        {blocked ? (
          <View className="px-4 py-10 items-center">
            <Ionicons name="ban-outline" size={32} color={c.muted} />
            {profile.is_blocked ? (
              <>
                <Text className="text-center mt-3" style={{ color: c.muted }}>
                  You blocked @{profile.username}.
                </Text>
                <Pressable
                  onPress={() => unblock.mutate()}
                  disabled={unblock.isPending}
                  className="rounded-full px-5 py-2 mt-4"
                  style={{ borderWidth: 1, borderColor: c.border }}
                >
                  <Text className="font-semibold text-[13px]" style={{ color: c.text }}>Unblock</Text>
                </Pressable>
              </>
            ) : (
              <Text className="text-center mt-3" style={{ color: c.muted }}>This account is unavailable.</Text>
            )}
          </View>
        ) : (
          // Tab bar
          <View className="flex-row mt-4" style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
            {TABS.map((t) => (
              <Pressable key={t.key} onPress={() => setTab(t.key)} className="flex-1 items-center py-3">
                <Text className={`text-[14px]`} style={{ color: tab === t.key ? c.text : c.muted, fontWeight: tab === t.key ? 'bold' : undefined }}>
                  {t.label}
                </Text>
                {tab === t.key && <View className="h-0.5 w-10 rounded-full mt-2" style={{ backgroundColor: c.primary }} />}
              </Pressable>
            ))}
          </View>
        )}

        {/* Pinned post at the top of the Posts tab */}
        {!blocked && tab === 'posts' && profile.pinned_post && (
          <View>
            <View className="flex-row items-center gap-1.5 px-4 pt-3">
              <Ionicons name="pin" size={13} color={c.muted} />
              <Text className="text-xs font-semibold" style={{ color: c.muted }}>Pinned</Text>
            </View>
            <PostCard
              post={profile.pinned_post}
              onRepost={setRepostTarget}
              onLongPress={profile.is_self ? onPinToggle : undefined}
            />
          </View>
        )}
      </View>
    );
  };

  // ---- Active tab data ----
  // currentQ is a union of four differently-typed infinite queries, so items is
  // widened to any[] here — the per-tab renderItem narrows it back.
  const currentQ = { posts: postsQ, replies: repliesQ, media: mediaQ, reposts: repostsQ }[tab];
  const items: any[] = currentQ.data?.pages.flatMap((p: any) => p.results) ?? [];
  // Don't repeat the pinned post inside the Posts list.
  const pinnedId = profile?.pinned_post?.id;
  const postItems =
    tab === 'posts' && pinnedId ? (items as Post[]).filter((p) => p.id !== pinnedId) : items;

  const renderItem = ({ item }: { item: any }) => {
    if (tab === 'replies') return <ReplyRow reply={item as ProfileReply} />;
    return (
      <PostCard
        post={item as Post}
        onRepost={setRepostTarget}
        onLongPress={tab === 'posts' && profile?.is_self ? onPinToggle : undefined}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* header bar */}
      <View className="flex-row items-center gap-3 px-4 py-2" style={{ borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <Text className="text-lg font-bold" numberOfLines={1} style={{ color: c.text }}>
          {profile ? displayName(profile) : `@${username}`}
        </Text>
      </View>

      {profileQ.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.primary} />
        </View>
      ) : !profile ? (
        <Text className="text-center mt-24" style={{ color: c.muted }}>Profile not found.</Text>
      ) : (
        <FlatList
          data={blocked ? [] : (postItems as any[])}
          keyExtractor={(item) => `${tab}-${item.id}`}
          ListHeaderComponent={Header}
          renderItem={renderItem}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (!blocked && currentQ.hasNextPage && !currentQ.isFetchingNextPage) {
              currentQ.fetchNextPage();
            }
          }}
          ListEmptyComponent={
            blocked ? null : currentQ.isLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : (
              <Text className="text-center mt-8" style={{ color: c.muted }}>Nothing here yet.</Text>
            )
          }
          ListFooterComponent={
            currentQ.isFetchingNextPage ? <ActivityIndicator color={c.primary} className="my-4" /> : null
          }
        />
      )}

      {/* Overflow menu (block / report) */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onPress={() => setMenuOpen(false)}>
          <View className="rounded-t-2xl pb-8" style={{ backgroundColor: c.card, paddingBottom: insets.bottom + 12 }}>
            <View className="items-center py-3">
              <View className="w-10 h-1 rounded-full" style={{ backgroundColor: c.border }} />
            </View>
            <Pressable onPress={confirmBlock} className="flex-row items-center gap-3 px-5 py-4">
              <Ionicons name="ban-outline" size={20} color="#ef4444" />
              <Text className="text-[15px] font-medium" style={{ color: '#ef4444' }}>Block @{username}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="flex-row items-center gap-3 px-5 py-4"
            >
              <Ionicons name="flag-outline" size={20} color={c.text} />
              <Text className="text-[15px] font-medium" style={{ color: c.text }}>Report @{username}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Report modal */}
      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="rounded-t-2xl px-5 pt-5" style={{ backgroundColor: c.card, paddingBottom: insets.bottom + 16 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold" style={{ color: c.text }}>Report @{username}</Text>
              <Pressable onPress={() => setReportOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={c.muted} />
              </Pressable>
            </View>
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setReportReason(r.key)}
                className="flex-row items-center justify-between py-3"
                style={{ borderBottomWidth: 1, borderBottomColor: c.border }}
              >
                <Text className="text-[15px]" style={{ color: c.text }}>{r.label}</Text>
                {reportReason === r.key && <Ionicons name="checkmark" size={20} color={c.primary} />}
              </Pressable>
            ))}
            <TextInput
              value={reportDetail}
              onChangeText={setReportDetail}
              placeholder="Add details (optional)"
              placeholderTextColor={c.muted}
              multiline
              className="rounded-xl px-4 py-3 text-[14px] mt-4 min-h-[72px]"
              style={{ backgroundColor: c.surface, color: c.text }}
            />
            <Pressable
              onPress={submitReport}
              disabled={report.isPending}
              className="rounded-full items-center py-3 mt-4"
              style={{ backgroundColor: c.primary }}
            >
              {report.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="font-bold text-[15px]" style={{ color: '#fff' }}>Submit report</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <RepostSheet post={repostTarget} onClose={() => setRepostTarget(null)} />
    </View>
  );
}
