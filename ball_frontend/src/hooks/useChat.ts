import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getConversations,
  getConversation,
  createConversation,
  leaveConversation,
  getMessages,
  sendMessage,
  votePoll,
  getConversationMembers,
  kickMember,
  promoteMember,
  getPublicChannels,
  joinChannel,
  getPinnedMessages,
  pinMessage,
  unpinMessage,
  type CreateConversationPayload,
  type MessageType,
  type PinnedMessage,
} from '../api/chat';

export const chatKeys = {
  conversations: ['chat', 'conversations'] as const,
  conversation: (id: number) => ['chat', 'conversation', id] as const,
  messages: (id: number) => ['chat', 'messages', id] as const,
  members: (id: number) => ['chat', 'members', id] as const,
  pinned: (id: number) => ['chat', 'pinned', id] as const,
  publicChannels: ['chat', 'publicChannels'] as const,
};

// Refresh pinned cards periodically so a pinned live match_card updates its
// score (reuses match_card's live serializer, just fetched on an interval).
// Only polls when at least one pin is a live-ish match card — text/poll pins
// never change, so a static list shouldn't wake the network up.
const PINNED_REFRESH_MS = 45000;

export const usePinnedMessages = (conversationId: number, enabled = true) =>
  useQuery({
    queryKey: chatKeys.pinned(conversationId),
    queryFn: () => getPinnedMessages(conversationId),
    enabled: enabled && !!conversationId,
    refetchInterval: (query) => {
      const pins = query.state.data as PinnedMessage[] | undefined;
      const hasLiveCard = (pins ?? []).some(
        (p) =>
          p.message.message_type === 'match_card' &&
          (p.message.match_card?.status === 'live' || p.message.match_card?.status === 'scheduled'),
      );
      return hasLiveCard ? PINNED_REFRESH_MS : false;
    },
  });

export const usePinMessage = (conversationId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => pinMessage(conversationId, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.pinned(conversationId) }),
  });
};

export const useUnpinMessage = (conversationId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => unpinMessage(conversationId, messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.pinned(conversationId) }),
  });
};

export const useConversations = () =>
  useQuery({ queryKey: chatKeys.conversations, queryFn: getConversations });

export const useConversation = (id: number) =>
  useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: () => getConversation(id),
    enabled: !!id,
  });

// Listing messages also advances the viewer's read cursor server-side
// (Membership.last_read_at), so the conversations list's unread counts are
// stale after a thread is opened — invalidate on success.
export const useMessages = (conversationId: number) => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: async () => {
      const messages = await getMessages(conversationId);
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      return messages;
    },
    enabled: !!conversationId,
  });
};

export const useCreateConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateConversationPayload) => createConversation(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.conversations }),
  });
};

export const useLeaveConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => leaveConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.conversations }),
  });
};

export const useSendMessage = (conversationId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      content?: string;
      message_type?: MessageType;
      match_id?: number | null;
      metadata?: Record<string, unknown> | null;
    }) => sendMessage(conversationId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
};

export const useVotePoll = (conversationId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, optionIndex }: { messageId: number; optionIndex: number }) =>
      votePoll(messageId, optionIndex),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.messages(conversationId) }),
  });
};

export const useConversationMembers = (conversationId: number, enabled = true) =>
  useQuery({
    queryKey: chatKeys.members(conversationId),
    queryFn: () => getConversationMembers(conversationId),
    enabled: enabled && !!conversationId,
  });

export const useKickMember = (conversationId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => kickMember(conversationId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.members(conversationId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversation(conversationId) });
    },
  });
};

export const usePromoteMember = (conversationId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => promoteMember(conversationId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.members(conversationId) }),
  });
};

export const usePublicChannels = () =>
  useQuery({ queryKey: chatKeys.publicChannels, queryFn: getPublicChannels });

export const useJoinChannel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channelId: number) => joinChannel(channelId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      qc.invalidateQueries({ queryKey: chatKeys.publicChannels });
    },
  });
};
