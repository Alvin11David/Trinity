import { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../../src/store/authStore';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';
import {
  useConversation,
  useConversationMembers,
  useKickMember,
  usePromoteMember,
  useLeaveConversation,
} from '../../../../src/hooks/useChat';
import { ChatThread } from '../../../../src/components/chat/ChatThread';
import { Avatar, displayName } from '../../../../src/components/feed/Avatar';
import { extractApiError, type Conversation } from '../../../../src/api/chat';
import { conversationTitle } from '../../../../src/lib/conversation';

function MembersModal({
  visible,
  onClose,
  conversation,
}: {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation;
}) {
  const c = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const { data: members, isLoading } = useConversationMembers(conversation.id, visible);
  const kick = useKickMember(conversation.id);
  const promote = usePromoteMember(conversation.id);
  const viewerIsAdmin = conversation.membership?.role === 'admin';

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
                  <View className="flex-row items-center gap-3 py-2.5 border-b" style={{ borderBottomColor: c.border + '80' }}>
                    <Avatar author={item.user} size={34} />
                    <View className="flex-1">
                      <Text className="text-sm font-medium" style={{ color: c.text }}>
                        {displayName(item.user)}
                        {isSelf ? '  (you)' : ''}
                      </Text>
                      {item.role === 'admin' && (
                        <Text className="text-[11px] font-semibold" style={{ color: c.primary }}>Admin</Text>
                      )}
                    </View>
                    {viewerIsAdmin && !isSelf && (
                      <View className="flex-row gap-2">
                        {item.role !== 'admin' && (
                          <Pressable
                            className="rounded-lg border px-2.5 py-1.5"
                            style={{ borderColor: c.primary + '80' }}
                            onPress={() =>
                              promote.mutate(item.user.id, {
                                onError: (e) => Alert.alert('Promote failed', extractApiError(e)),
                              })
                            }
                          >
                            <Text className="text-xs font-medium" style={{ color: c.primary }}>Make admin</Text>
                          </Pressable>
                        )}
                        <Pressable
                          className="rounded-lg border px-2.5 py-1.5"
                          style={{ borderColor: '#ef444480' }}
                          onPress={() =>
                            Alert.alert(
                              'Remove member',
                              `Remove ${displayName(item.user)} from this ${conversation.conversation_type}?`,
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

export default function ConversationScreen() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const user = useAuthStore((s) => s.user);
  const { data: conversation, isLoading } = useConversation(conversationId);
  const leave = useLeaveConversation();
  const [membersOpen, setMembersOpen] = useState(false);

  const title = useMemo(
    () => (conversation ? conversationTitle(conversation, user?.id) : ''),
    [conversation, user?.id],
  );

  if (isLoading || !conversation) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: c.bg }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b px-3 pt-14 pb-3" style={{ borderBottomColor: c.border }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-bold text-base" numberOfLines={1} style={{ color: c.text }}>
            {title}
          </Text>
          <Text className="text-xs" style={{ color: c.muted }}>
            {conversation.conversation_type === 'direct'
              ? 'Direct message'
              : `${conversation.conversation_type === 'channel' ? 'Channel' : 'Group'} · ${conversation.participants.length} member${conversation.participants.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        {conversation.conversation_type !== 'direct' && (
          <Pressable onPress={() => setMembersOpen(true)} hitSlop={8}>
            <Ionicons name="people-outline" size={20} color={c.muted} />
          </Pressable>
        )}
        <Pressable
          hitSlop={8}
          onPress={() =>
            Alert.alert('Leave conversation', 'You can rejoin public channels later.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: () =>
                  leave.mutate(conversationId, {
                    onSuccess: () => router.back(),
                    onError: (e) => Alert.alert('Leave failed', extractApiError(e)),
                  }),
              },
            ])
          }
        >
          <Ionicons name="exit-outline" size={20} color={c.muted} />
        </Pressable>
      </View>

      <ChatThread conversation={conversation} />
      <MembersModal
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
        conversation={conversation}
      />
    </View>
  );
}
