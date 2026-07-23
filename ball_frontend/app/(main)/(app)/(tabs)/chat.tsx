import { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from 'react-native';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../../src/components/feed/Avatar';
import { useAuthStore } from '../../../../src/store/authStore';
import { useConversations } from '../../../../src/hooks/useChat';
import { useCommunities, useMyCommunities, useCreateCommunity, useToggleJoinCommunity } from '../../../../src/hooks/useCommunities';
import { extractApiError, type Conversation, type ChatMessage } from '../../../../src/api/chat';
import type { Community } from '../../../../src/api/communities';
import { conversationTitle } from '../../../../src/lib/conversation';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type Segment = 'chats' | 'communities';

function ConversationRow({ conversation, c }: { conversation: Conversation; c: ReturnType<typeof useThemeColors> }) {
  const user = useAuthStore((s) => s.user);
  const title = conversationTitle(conversation, user?.id);
  const other = conversation.conversation_type === 'direct' ? conversation.participants.find((p) => p.id !== user?.id) : null;

  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/chat/${conversation.id}` as Href)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: c.border,
      }}
    >
      {other ? (
        <Avatar author={other} size={44} />
      ) : conversation.avatar ? (
        <Image source={{ uri: conversation.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people-outline" size={18} color={c.muted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>{conversation.last_message?.content || 'No messages yet'}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {conversation.last_message && (
          <Text style={{ fontSize: 10, color: c.muted }}>{new Date(conversation.last_message.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
        )}
        {conversation.unread_count > 0 && (
          <View style={{ backgroundColor: c.primary, borderRadius: 999, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function CommunityRow({ community, c }: { community: Community; c: ReturnType<typeof useThemeColors> }) {
  const toggle = useToggleJoinCommunity(community.id);
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/community/${community.id}` as Href)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: c.border,
      }}
    >
      {community.avatar ? (
        <Image source={{ uri: community.avatar }} style={{ width: 44, height: 44, borderRadius: 10 }} contentFit="cover" />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people" size={18} color={c.muted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }} numberOfLines={1}>{community.name}</Text>
          {community.is_official && <Ionicons name="checkmark-circle" size={14} color={c.primary} />}
        </View>
        <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }} numberOfLines={1}>
          {community.members_count} member{community.members_count === 1 ? '' : 's'}{community.description ? ` · ${community.description}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => toggle.mutate(undefined, { onError: (e) => Alert.alert('Failed', extractApiError(e)) })}
        disabled={toggle.isPending}
        style={{
          borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1,
          borderColor: community.is_member ? c.border : c.primary,
          backgroundColor: community.is_member ? c.surface : c.primary,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: community.is_member ? c.muted : '#fff' }}>
          {community.is_member ? 'Joined' : 'Join'}
        </Text>
      </Pressable>
    </Pressable>
  );
}

function ChatsSegment({ c }: { c: ReturnType<typeof useThemeColors> }) {
  const { data, isLoading, refetch, isRefetching } = useConversations();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => router.push('/(main)/(app)/chat/channels' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="radio-outline" size={16} color={c.primary} />
          <Text style={{ fontSize: 12, fontWeight: '500', color: c.primary }}>Channels</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(main)/(app)/chat/new' as Href)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="create-outline" size={16} color={c.primary} />
          <Text style={{ fontSize: 12, fontWeight: '500', color: c.primary }}>New</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 64 }} color={c.primary} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(conv) => String(conv.id)}
          renderItem={({ item }) => <ConversationRow conversation={item} c={c} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 80, gap: 8 }}>
              <Ionicons name="chatbubbles-outline" size={32} color={c.gray300} />
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center' }}>No conversations yet. Start a DM, create a group, or join a public channel.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function CommunitiesSegment({ c }: { c: ReturnType<typeof useThemeColors> }) {
  const { data: all, isLoading, refetch, isRefetching } = useCommunities();
  const { data: mine } = useMyCommunities();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateCommunity();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => setCreateOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="add-circle-outline" size={16} color={c.primary} />
          <Text style={{ fontSize: 12, fontWeight: '500', color: c.primary }}>New community</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 64 }} color={c.primary} />
      ) : (
        <FlatList
          data={[...(mine ?? []), ...(all ?? []).filter((co) => !(mine ?? []).some((m) => m.id === co.id))]}
          keyExtractor={(co) => String(co.id)}
          renderItem={({ item }) => <CommunityRow community={item} c={c} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 80, gap: 8 }}>
              <Ionicons name="people-outline" size={32} color={c.gray300} />
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center' }}>No communities yet — create the first one.</Text>
            </View>
          }
        />
      )}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: c.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>New community</Text>
            <TextInput style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: c.text }} placeholder="Name" placeholderTextColor={c.muted} value={name} onChangeText={setName} />
            <TextInput style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: c.text }} placeholder="Description (optional)" placeholderTextColor={c.muted} value={description} onChangeText={setDescription} multiline />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable style={{ flex: 1, borderRadius: 8, borderWidth: 1, borderColor: c.border, paddingVertical: 10, alignItems: 'center' }} onPress={() => setCreateOpen(false)}>
                <Text style={{ fontWeight: '500', color: c.muted }}>Cancel</Text>
              </Pressable>
              <Pressable disabled={!name.trim() || create.isPending} style={{ flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: name.trim() ? c.primary : c.gray200 }} onPress={() => create.mutate({ name: name.trim(), description: description.trim() || undefined }, { onSuccess: () => { setName(''); setDescription(''); setCreateOpen(false); }, onError: (e) => Alert.alert('Failed', extractApiError(e)) })}>
                <Text style={{ fontWeight: '600', color: name.trim() ? '#fff' : c.muted }}>Create</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function ChatScreen() {
  const [segment, setSegment] = useState<Segment>('chats');
  const c = useThemeColors();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: c.text }}>Messages</Text>
      </View>

      {/* Tabs - Trinity style: underline */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border }}>
        {(['chats', 'communities'] as const).map((s) => (
          <Pressable key={s} onPress={() => setSegment(s)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: segment === s ? c.primary : 'transparent' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: segment === s ? c.primary : c.muted }}>
              {s === 'chats' ? 'Chats' : 'Communities'}
            </Text>
          </Pressable>
        ))}
      </View>

      {segment === 'chats' ? <ChatsSegment c={c} /> : <CommunitiesSegment c={c} />}
    </View>
  );
}
