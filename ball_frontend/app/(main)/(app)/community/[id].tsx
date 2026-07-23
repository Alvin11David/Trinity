import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router, Stack, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../../src/store/authStore';
import {
  useCommunity,
  useCommunityPosts,
  useCreateCommunityPost,
  useDeleteCommunityPost,
  useVoteCommunityPost,
  useTogglePinPost,
  useToggleJoinCommunity,
  useCommunityMembers,
  useKickCommunityMember,
  usePromoteCommunityMember,
  useCreateCommunityRoom,
} from '../../../../src/hooks/useCommunities';
import { Avatar, displayName } from '../../../../src/components/feed/Avatar';
import { extractApiError } from '../../../../src/api/chat';
import type { Community, CommunityPost, VoteType } from '../../../../src/api/communities';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function PostCard({
  post,
  community,
}: {
  post: CommunityPost;
  community: Community;
}) {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const vote = useVoteCommunityPost(community.id);
  const pin = useTogglePinPost(community.id);
  const del = useDeleteCommunityPost(community.id);
  const isModerator = community.user_role === 'moderator';
  const isAuthor = post.author.id === user?.id;

  const castVote = (voteType: VoteType) => {
    // Voting is membership-gated server-side — surface the reason up front
    // instead of a bare disabled button or an opaque 403.
    if (!community.is_member) {
      Alert.alert('Members only', 'Join the community to vote on posts.');
      return;
    }
    vote.mutate(
      { postId: post.id, voteType },
      { onError: (e) => Alert.alert('Vote failed', extractApiError(e)) },
    );
  };

  return (
    <View className="border-b border-border/40 px-4 py-3" style={{ borderBottomColor: c.border }}>
      <View className="flex-row items-center gap-2.5">
        <Avatar author={post.author} size={30} />
        <View className="flex-1 flex-row items-center gap-1.5">
          <Text className="text-sm font-semibold" style={{ color: c.text }} numberOfLines={1}>
            {displayName(post.author)}
          </Text>
          <Text className="text-xs" style={{ color: c.muted }}>· {timeAgo(post.created_at)}</Text>
          {post.is_pinned && <Ionicons name="pin" size={12} color={c.primary} />}
        </View>
        {(isModerator || isAuthor) && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              const actions: any[] = [];
              if (isModerator) {
                actions.push({
                  text: post.is_pinned ? 'Unpin' : 'Pin',
                  onPress: () =>
                    pin.mutate(post.id, {
                      onError: (e) => Alert.alert('Pin failed', extractApiError(e)),
                    }),
                });
              }
              actions.push({
                text: 'Delete',
                style: 'destructive',
                onPress: () =>
                  del.mutate(post.id, {
                    onError: (e) => Alert.alert('Delete failed', extractApiError(e)),
                  }),
              });
              actions.push({ text: 'Cancel', style: 'cancel' });
              Alert.alert('Post', undefined, actions);
            }}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={c.muted} />
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={
          post.match_id != null
            ? () => router.push(`/(main)/(app)/match/${post.match_id}` as Href)
            : undefined
        }
      >
        <Text className="text-[15px] leading-5 mt-2" style={{ color: c.text }}>{post.content}</Text>
        {post.match_id != null && (
          <Text className="text-xs mt-1" style={{ color: c.primary }}>View match →</Text>
        )}
      </Pressable>

      <View className="flex-row items-center gap-4 mt-2.5">
        <Pressable onPress={() => castVote('up')} className="flex-row items-center gap-1" hitSlop={6}>
          <Ionicons
            name={post.user_vote === 'up' ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
            size={20}
            color={post.user_vote === 'up' ? c.primary : c.muted}
          />
          <Text
            className={`text-xs font-medium ${post.user_vote === 'up' ? 'text-primary' : 'text-textSecondary'}`}
          >
            {post.upvotes}
          </Text>
        </Pressable>
        <Pressable onPress={() => castVote('down')} className="flex-row items-center gap-1" hitSlop={6}>
          <Ionicons
            name={post.user_vote === 'down' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
            size={20}
            color={post.user_vote === 'down' ? '#ef4444' : c.muted}
          />
          <Text
            className={`text-xs font-medium ${post.user_vote === 'down' ? 'text-redCard' : 'text-textSecondary'}`}
          >
            {post.downvotes}
          </Text>
        </Pressable>
        {!community.is_member && (
          <Text className="text-[11px] italic" style={{ color: c.muted }}>Join to vote</Text>
        )}
      </View>
    </View>
  );
}

function CommunityMembersModal({
  visible,
  onClose,
  community,
}: {
  visible: boolean;
  onClose: () => void;
  community: Community;
}) {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const { data: members, isLoading } = useCommunityMembers(community.id, visible);
  const kick = useKickCommunityMember(community.id);
  const promote = usePromoteCommunityMember(community.id);
  const viewerIsModerator = community.user_role === 'moderator';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="rounded-t-2xl p-4 max-h-[70%]" style={{ backgroundColor: c.card }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-bold text-base" style={{ color: c.text }}>Members</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={c.muted} />
            </Pressable>
          </View>
          {isLoading ? (
            <ActivityIndicator color={c.primary} />
          ) : (
            <FlatList
              data={members ?? []}
              keyExtractor={(m) => String(m.id)}
              renderItem={({ item }) => {
                const isSelf = item.user.id === user?.id;
                return (
                  <View className="flex-row items-center gap-3 py-2.5" style={{ borderBottomColor: c.border }}>
                    <Avatar author={item.user} size={34} />
                    <View className="flex-1">
                      <Text className="text-sm font-medium" style={{ color: c.text }}>
                        {displayName(item.user)}
                        {isSelf ? '  (you)' : ''}
                      </Text>
                      {item.role === 'moderator' && (
                        <Text className="text-[11px] font-semibold" style={{ color: c.primary }}>Moderator</Text>
                      )}
                    </View>
                    {viewerIsModerator && !isSelf && (
                      <View className="flex-row gap-2">
                        {item.role !== 'moderator' && (
                          <Pressable
                            className="rounded-lg px-2.5 py-1.5"
                            style={{ borderColor: c.primary, borderWidth: 1 }}
                            onPress={() =>
                              promote.mutate(item.user.id, {
                                onError: (e) => Alert.alert('Promote failed', extractApiError(e)),
                              })
                            }
                          >
                            <Text className="text-xs font-medium" style={{ color: c.primary }}>Make mod</Text>
                          </Pressable>
                        )}
                        <Pressable
                          className="rounded-lg px-2.5 py-1.5"
                          style={{ borderColor: '#ef4444', borderWidth: 1 }}
                          onPress={() =>
                            Alert.alert(
                              'Remove member',
                              `Remove ${displayName(item.user)}? They will also be removed from the community's chat channel.`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Remove',
                                  style: 'destructive',
                                  onPress: () =>
                                    kick.mutate(item.user.id, {
                                      onError: (e) => Alert.alert('Kick failed', extractApiError(e)),
                                    }),
                                },
                              ],
                            )
                          }
                        >
                          <Text className="text-xs font-medium" style={{ color: '#ef4444' }}>Kick</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function CommunityScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const communityId = Number(id);
  const { data: community, isLoading } = useCommunity(communityId);
  const { data: posts, isLoading: postsLoading } = useCommunityPosts(communityId);
  const createPost = useCreateCommunityPost(communityId);
  const toggleJoin = useToggleJoinCommunity(communityId);
  const createRoom = useCreateCommunityRoom(communityId);
  const [draft, setDraft] = useState('');
  const [membersOpen, setMembersOpen] = useState(false);

  if (isLoading || !community) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  const isModerator = community.user_role === 'moderator';

  const openChat = () => {
    if (community.room_conversation_id) {
      router.push(`/(main)/(app)/chat/${community.room_conversation_id}` as Href);
    }
  };

  const enableChat = () =>
    createRoom.mutate(undefined, {
      onSuccess: (r) => router.push(`/(main)/(app)/chat/${r.conversation_id}` as Href),
      onError: (e) => Alert.alert('Failed', extractApiError(e)),
    });

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center gap-3 border-b border-border px-3 pt-14 pb-3" style={{ borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-1.5">
          <Text className="font-bold text-base" style={{ color: c.text }} numberOfLines={1}>
            {community.name}
          </Text>
          {community.is_official && <Ionicons name="checkmark-circle" size={15} color={c.primary} />}
        </View>
        <Pressable onPress={() => setMembersOpen(true)} hitSlop={8}>
          <Ionicons name="people-outline" size={20} color={c.muted} />
        </Pressable>
      </View>

      <FlatList
        data={posts ?? []}
        keyExtractor={(p) => String(p.id)}
        renderItem={({ item }) => <PostCard post={item} community={community} />}
        ListHeaderComponent={
          <View className="border-b border-border" style={{ borderBottomColor: c.border }}>
            {community.banner && (
              <Image source={{ uri: community.banner }} style={{ width: '100%', height: 110 }} contentFit="cover" />
            )}
            <View className="px-4 py-3 gap-2">
              {community.description ? (
                <Text className="text-sm" style={{ color: c.muted }}>{community.description}</Text>
              ) : null}
              <View className="flex-row items-center gap-2 flex-wrap">
                <Text className="text-xs" style={{ color: c.muted }}>
                  {community.members_count} member{community.members_count === 1 ? '' : 's'}
                </Text>
                {community.user_role && (
                  <View className="rounded-full bg-primary/15 px-2 py-0.5" style={{ borderColor: c.primary, borderWidth: 1, opacity: 0.4 }}>
                    <Text className="text-[10px] font-semibold uppercase" style={{ color: c.primary }}>
                      {community.user_role}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row gap-2 mt-1">
                <Pressable
                  onPress={() =>
                    toggleJoin.mutate(undefined, {
                      onError: (e) => Alert.alert('Failed', extractApiError(e)),
                    })
                  }
                  disabled={toggleJoin.isPending}
                  className="rounded-lg px-4 py-2"
                  style={
                    community.is_member
                      ? { borderColor: c.border, borderWidth: 1, backgroundColor: c.surface }
                      : { borderColor: c.primary, borderWidth: 1, backgroundColor: c.primary }
                  }
                >
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: community.is_member ? c.muted : '#fff' }}
                  >
                    {community.is_member ? 'Leave' : 'Join'}
                  </Text>
                </Pressable>
                {community.room_conversation_id ? (
                  <Pressable
                    onPress={openChat}
                    className="flex-row items-center gap-1.5 rounded-lg px-4 py-2"
                    style={{ borderColor: c.primary, borderWidth: 1, backgroundColor: c.primary, opacity: 0.1 }}
                  >
                    <Ionicons name="chatbubbles-outline" size={14} color={c.primary} />
                    <Text className="text-xs font-semibold" style={{ color: c.primary }}>Open chat</Text>
                  </Pressable>
                ) : isModerator ? (
                  <Pressable
                    onPress={enableChat}
                    disabled={createRoom.isPending}
                    className="flex-row items-center gap-1.5 rounded-lg px-4 py-2"
                    style={{ borderColor: c.primary, borderWidth: 1, backgroundColor: c.primary, opacity: 0.1 }}
                  >
                    <Ionicons name="chatbubbles-outline" size={14} color={c.primary} />
                    <Text className="text-xs font-semibold" style={{ color: c.primary }}>
                      {createRoom.isPending ? 'Enabling…' : 'Enable chat'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          postsLoading ? (
            <ActivityIndicator className="mt-10" color={c.primary} />
          ) : (
            <View className="items-center pt-14 px-8">
              <Text className="text-sm" style={{ color: c.muted }}>No posts yet.</Text>
            </View>
          )
        }
      />

      {community.is_member ? (
        <View className="flex-row items-end gap-2 border-t border-border px-3 py-2" style={{ borderTopColor: c.border }}>
          <TextInput
            className="flex-1 rounded-2xl px-3 py-2 max-h-24"
            style={{ backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, color: c.text }}
            placeholder={`Post in ${community.name}`}
            placeholderTextColor={c.muted}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            disabled={!draft.trim() || createPost.isPending}
            onPress={() =>
              createPost.mutate(
                { content: draft.trim() },
                {
                  onSuccess: () => setDraft(''),
                  onError: (e) => Alert.alert('Post failed', extractApiError(e)),
                },
              )
            }
            className="rounded-full p-2.5 mb-0.5"
            style={{ backgroundColor: draft.trim() ? c.primary : c.border }}
          >
            <Ionicons name="send" size={16} color={draft.trim() ? '#fff' : c.muted} />
          </Pressable>
        </View>
      ) : (
        <View className="border-t border-border px-4 py-3" style={{ borderTopColor: c.border }}>
          <Text className="text-xs text-center" style={{ color: c.muted }}>Join the community to post and vote.</Text>
        </View>
      )}

      <CommunityMembersModal
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
        community={community}
      />
    </KeyboardAvoidingView>
  );
}
