import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import {
  useMessages,
  useVotePoll,
  usePinnedMessages,
  usePinMessage,
  useUnpinMessage,
} from '../../hooks/useChat';
import { useChatSocket, type LiveChatMessage } from '../../hooks/useChatSocket';
import { MessageBubble } from './MessageBubble';
import { PinnedOverlay } from './PinnedOverlay';
import { extractApiError, type ChatMessage, type Conversation } from '../../api/chat';
import { useThemeColors } from '../../hooks/useThemeColors';

// A live WS chat_message flattened into the REST ChatMessage shape so one
// renderer handles both. Only text/goal_event arrive this way (card/poll
// types trigger a REST refetch instead — see useChatSocket).
function liveToMessage(live: LiveChatMessage, conversationId: number): ChatMessage {
  return {
    id: live.message_id,
    conversation: conversationId,
    sender: {
      id: live.sender_id,
      username: live.sender_username,
      avatar: live.sender_avatar,
    },
    content: live.content,
    message_type: live.message_type,
    match_id: live.match_id,
    metadata: live.metadata,
    match_card: null,
    prediction_card: null,
    poll: null,
    is_read: false,
    created_at: live.created_at,
  };
}

function PollComposer({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (question: string, options: string[]) => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const c = useThemeColors();
  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = validOptions.length >= 2;

  const reset = () => {
    setQuestion('');
    setOptions(['', '']);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="bg-elevated rounded-t-2xl p-4 gap-3">
          <Text className="text-text font-bold text-base">New poll</Text>
          <TextInput
            className="bg-surface border border-border rounded-lg px-3 py-2 text-text"
            placeholder="Question (optional)"
            placeholderTextColor={c.muted}
            value={question}
            onChangeText={setQuestion}
          />
          {options.map((opt, i) => (
            <TextInput
              key={i}
              className="bg-surface border border-border rounded-lg px-3 py-2 text-text"
              placeholder={`Option ${i + 1}`}
              placeholderTextColor={c.muted}
              value={opt}
              onChangeText={(v) => setOptions((prev) => prev.map((o, j) => (j === i ? v : o)))}
            />
          ))}
          {options.length < 4 && (
            <Pressable onPress={() => setOptions((prev) => [...prev, ''])}>
              <Text className="text-primary text-sm">+ Add option</Text>
            </Pressable>
          )}
          <View className="flex-row gap-3 mt-1">
            <Pressable
              className="flex-1 rounded-lg border border-border py-2.5 items-center"
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text className="text-textSecondary font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!canSubmit}
              className={`flex-1 rounded-lg py-2.5 items-center ${canSubmit ? 'bg-primary' : 'bg-border'}`}
              onPress={() => {
                onSubmit(question.trim(), validOptions);
                reset();
                onClose();
              }}
            >
              <Text className={canSubmit ? 'text-background font-semibold' : 'text-textMuted'}>
                Create poll
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Reusable thread body: REST history + live WS messages + typing indicator +
 * composer. Used by the conversation screen, the community companion channel,
 * and the MatchRoom chat — one thread UI, opened against different
 * conversation ids.
 */
export function ChatThread({
  conversation,
  canSend = true,
}: {
  conversation: Conversation;
  canSend?: boolean;
}) {
  const conversationId = conversation.id;
  const user = useAuthStore((s) => s.user);
  const { data: restMessages, isLoading } = useMessages(conversationId);
  const {
    connected,
    liveMessages,
    typingUsers,
    lastError,
    clearError,
    sendChatMessage,
    sendTyping,
  } = useChatSocket(conversationId, user?.id);
  const votePollMutation = useVotePoll(conversationId);

  const [draft, setDraft] = useState('');
  const [pollOpen, setPollOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const typingSentAt = useRef(0);
  const c = useThemeColors();

  const isMatchRoom = conversation.is_match_room;
  const showSender = conversation.conversation_type !== 'direct';
  // Broadcast channels: only admins may post.
  const isBroadcast =
    conversation.conversation_type === 'channel' && conversation.channel_mode === 'broadcast';
  const composerEnabled =
    canSend && (!isBroadcast || conversation.membership?.role === 'admin');

  // Pin permission mirrors the backend rule (chat.views._can_pin): never in
  // match rooms; channels are admin-only; direct/group any member. Gated in
  // the UI so the long-press option doesn't even appear if it'd be rejected.
  const canPin =
    !isMatchRoom &&
    !!conversation.membership &&
    (conversation.conversation_type === 'channel'
      ? conversation.membership.role === 'admin'
      : true);

  const { data: pinnedMessages } = usePinnedMessages(conversationId);
  const pinMutation = usePinMessage(conversationId);
  const unpinMutation = useUnpinMessage(conversationId);

  const messages = useMemo(() => {
    const rest = restMessages ?? [];
    const restIds = new Set(rest.map((m) => m.id));
    const live = liveMessages
      .filter((m) => !restIds.has(m.message_id))
      .map((m) => liveToMessage(m, conversationId));
    return [...rest, ...live];
  }, [restMessages, liveMessages, conversationId]);

  const handleLongPress = useCallback(
    (message: ChatMessage) => {
      if (!canPin) return;
      const already = (pinnedMessages ?? []).some((p) => p.message.id === message.id);
      if (already) return; // unpin from the floating card, not from the thread
      Alert.alert('Pin message', 'Pin this message to the top of the chat?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pin',
          onPress: () =>
            pinMutation.mutate(message.id, {
              onError: (e) => Alert.alert('Pin failed', extractApiError(e)),
            }),
        },
      ]);
    },
    [canPin, pinnedMessages, pinMutation],
  );

  const jumpToMessage = useCallback(
    (messageId: number) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
      }
    },
    [messages],
  );

  const throttledTyping = useCallback(() => {
    const now = Date.now();
    if (now - typingSentAt.current > 2500) {
      typingSentAt.current = now;
      sendTyping(true);
    }
  }, [sendTyping]);

  const submit = useCallback(() => {
    const content = draft.trim();
    if (!content) return;
    const ok = sendChatMessage({ message_type: 'text', content });
    if (ok) {
      setDraft('');
      sendTyping(false);
    }
  }, [draft, sendChatMessage, sendTyping]);

  const submitPoll = useCallback(
    (question: string, options: string[]) => {
      sendChatMessage({ message_type: 'poll', content: question, metadata: { options } });
    },
    [sendChatMessage],
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={c.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isOwn={item.sender.id === user?.id}
              showSender={showSender}
              onVotePoll={(messageId, optionIndex) =>
                votePollMutation.mutate({ messageId, optionIndex })
              }
              onLongPress={canPin ? () => handleLongPress(item) : undefined}
            />
          )}
          contentContainerStyle={{ paddingVertical: 12 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onScrollToIndexFailed={({ index, averageItemLength }) => {
            // Row not measured yet — approximate, then retry once measured.
            listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: true });
            setTimeout(() => {
              if (index < messages.length) {
                listRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
              }
            }, 250);
          }}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-textMuted text-sm">No messages yet</Text>
            </View>
          }
        />
      )}

      {/* Floating draggable pinned-message cards over the thread. */}
      {pinnedMessages && pinnedMessages.length > 0 && (
        <PinnedOverlay
          conversationId={conversationId}
          pins={pinnedMessages}
          canManage={canPin}
          onJump={jumpToMessage}
          onUnpin={(messageId) =>
            unpinMutation.mutate(messageId, {
              onError: (e) => Alert.alert('Unpin failed', extractApiError(e)),
            })
          }
        />
      )}

      {typingUsers.length > 0 && (
        <View className="px-4 pb-1">
          <Text className="text-textMuted text-xs italic">
            {typingUsers.map((t) => t.username).join(', ')}{' '}
            {typingUsers.length === 1 ? 'is' : 'are'} typing…
          </Text>
        </View>
      )}

      {lastError && (
        <Pressable
          onPress={clearError}
          className="mx-3 mb-1 rounded-lg bg-redCard/15 border border-redCard/40 px-3 py-2"
        >
          <Text className="text-redCard text-xs">{lastError} (tap to dismiss)</Text>
        </Pressable>
      )}

      {composerEnabled ? (
        <View className="flex-row items-end gap-2 border-t border-border px-3 py-2">
          {/* Match rooms are text-only (+ system goal_events) — no poll/card
              creation entry point. Backend rejects them regardless; this just
              hides the affordance. */}
          {!isMatchRoom && (
            <Pressable onPress={() => setPollOpen(true)} hitSlop={8} className="pb-2">
              <Ionicons name="stats-chart-outline" size={20} color={c.muted} />
            </Pressable>
          )}
          <TextInput
            className="flex-1 bg-surface border border-border rounded-2xl px-3 py-2 text-text max-h-24"
            placeholder={connected ? 'Message' : 'Connecting…'}
            placeholderTextColor={c.muted}
            value={draft}
            onChangeText={(v) => {
              setDraft(v);
              if (v) throttledTyping();
            }}
            multiline
            editable={connected}
          />
          <Pressable
            onPress={submit}
            disabled={!connected || !draft.trim()}
            className={`rounded-full p-2.5 mb-0.5 ${connected && draft.trim() ? 'bg-primary' : 'bg-border'}`}
          >
            <Ionicons
              name="send"
              size={16}
              color={connected && draft.trim() ? c.bg : c.muted}
            />
          </Pressable>
        </View>
      ) : (
        <View className="border-t border-border px-4 py-3">
          <Text className="text-textMuted text-xs text-center">
            Only admins can post in this channel.
          </Text>
        </View>
      )}

      <PollComposer visible={pollOpen} onClose={() => setPollOpen(false)} onSubmit={submitPoll} />
    </KeyboardAvoidingView>
  );
}
