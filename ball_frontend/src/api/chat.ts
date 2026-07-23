import { apiClient } from './client';
import type { PostAuthor } from './feed';

// ---------------------------------------------------------------------------
// Types — mirror chat/serializers.py exactly.
// ---------------------------------------------------------------------------

export type ConversationType = 'direct' | 'group' | 'channel';
export type ChannelMode = 'open' | 'broadcast' | null;
export type MessageType = 'text' | 'match_card' | 'prediction_card' | 'poll' | 'goal_event';
export type ChatRole = 'admin' | 'member';

export interface ChatMembership {
  id: number;
  user: PostAuthor; // users.serializers.UserSerializer — same shape feed already types
  role: ChatRole;
  joined_at: string;
  last_read_at: string | null;
}

// MessageSerializer.get_match_card → MatchCardSerializer (no goal_scorers here)
export interface ChatMatchCard {
  id: number;
  league: string | null;
  home_team: string;
  away_team: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  kickoff_time: string;
  status: string;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  has_prediction: boolean;
  updated_at: string;
}

export interface ChatPredictionCard {
  match: ChatMatchCard;
  prediction: Record<string, unknown>; // winnie_prediction JSON, shape owned by Winnie
}

export interface ChatPoll {
  options: string[];
  counts: number[];
  total_votes: number;
  user_vote: number | null;
}

// goal_event messages carry this in metadata (matches.tasks.create_goal_event_message)
export interface GoalEventMetadata {
  scorer: string;
  team: string;
  minute: number;
  assist: string | null;
  home_score: number | null;
  away_score: number | null;
}

export interface ChatMessage {
  id: number;
  conversation: number;
  sender: PostAuthor;
  content: string;
  message_type: MessageType;
  match_id: number | null;
  metadata: Record<string, unknown> | null;
  match_card: ChatMatchCard | null;
  prediction_card: ChatPredictionCard | null;
  poll: ChatPoll | null;
  is_read: boolean; // deprecated server-side; kept in payload
  created_at: string;
}

export interface Conversation {
  id: number;
  conversation_type: ConversationType;
  channel_mode: ChannelMode;
  name: string | null;
  description: string | null;
  avatar: string | null;
  is_public: boolean;
  participants: PostAuthor[];
  last_message: ChatMessage | null;
  unread_count: number;
  membership: ChatMembership | null; // the VIEWER's membership only
  is_match_room: boolean; // restricted surface: text/goal_event only, no pins
  created_at: string;
  updated_at: string;
}

export interface PinnedMessage {
  id: number;
  conversation: number;
  message: ChatMessage; // full nested message (match_card fields are live)
  pinned_by: PostAuthor | null;
  pinned_at: string;
}

export interface CreateConversationPayload {
  conversation_type: ConversationType;
  participant_ids: number[];
  name?: string;
  description?: string;
  is_public?: boolean;
  channel_mode?: 'open' | 'broadcast';
}

// ---------------------------------------------------------------------------
// Endpoints — /api/chat/ (chat/urls.py)
// ---------------------------------------------------------------------------

export const getConversations = async (): Promise<Conversation[]> => {
  const { data } = await apiClient.get<Conversation[]>('/api/chat/');
  return data;
};

export const getConversation = async (id: number): Promise<Conversation> => {
  const { data } = await apiClient.get<Conversation>(`/api/chat/${id}/`);
  return data;
};

// Returns the create-serializer's shape (id + create fields). For an existing
// DM the backend returns that conversation instead of duplicating.
export const createConversation = async (
  payload: CreateConversationPayload,
): Promise<{ id: number } & Partial<CreateConversationPayload>> => {
  const { data } = await apiClient.post('/api/chat/', payload);
  return data;
};

export const leaveConversation = async (id: number): Promise<void> => {
  await apiClient.post(`/api/chat/${id}/leave/`);
};

export const getMessages = async (conversationId: number): Promise<ChatMessage[]> => {
  const { data } = await apiClient.get<ChatMessage[]>(`/api/chat/${conversationId}/messages/`);
  return data;
};

// Fetch one message with its full nested render payload — used to patch a
// single card/poll into the cached thread when it arrives over the WS, instead
// of refetching the whole list.
export const getMessage = async (
  conversationId: number,
  messageId: number,
): Promise<ChatMessage> => {
  const { data } = await apiClient.get<ChatMessage>(
    `/api/chat/${conversationId}/messages/${messageId}/`,
  );
  return data;
};

export const sendMessage = async (
  conversationId: number,
  payload: {
    content?: string;
    message_type?: MessageType;
    match_id?: number | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<ChatMessage> => {
  const { data } = await apiClient.post<ChatMessage>(
    `/api/chat/${conversationId}/messages/send/`,
    payload,
  );
  return data;
};

export const votePoll = async (
  messageId: number,
  optionIndex: number,
): Promise<{ status: string; option_index: number }> => {
  const { data } = await apiClient.post(`/api/chat/messages/${messageId}/poll/vote/`, {
    option_index: optionIndex,
  });
  return data;
};

export const getConversationMembers = async (conversationId: number): Promise<ChatMembership[]> => {
  const { data } = await apiClient.get<ChatMembership[]>(`/api/chat/${conversationId}/members/`);
  return data;
};

export const kickMember = async (conversationId: number, userId: number): Promise<void> => {
  await apiClient.post(`/api/chat/${conversationId}/members/${userId}/kick/`);
};

export const promoteMember = async (conversationId: number, userId: number): Promise<void> => {
  await apiClient.post(`/api/chat/${conversationId}/members/${userId}/promote/`);
};

export const getPublicChannels = async (): Promise<Conversation[]> => {
  const { data } = await apiClient.get<Conversation[]>('/api/chat/channels/public/');
  return data;
};

export const joinChannel = async (channelId: number): Promise<void> => {
  await apiClient.post(`/api/chat/channels/${channelId}/join/`);
};

// --- Pinned messages ---

export const getPinnedMessages = async (conversationId: number): Promise<PinnedMessage[]> => {
  const { data } = await apiClient.get<PinnedMessage[]>(`/api/chat/${conversationId}/pinned/`);
  return data;
};

export const pinMessage = async (
  conversationId: number,
  messageId: number,
): Promise<PinnedMessage> => {
  const { data } = await apiClient.post<PinnedMessage>(
    `/api/chat/${conversationId}/messages/${messageId}/pin/`,
  );
  return data;
};

export const unpinMessage = async (conversationId: number, messageId: number): Promise<void> => {
  await apiClient.delete(`/api/chat/${conversationId}/messages/${messageId}/pin/`);
};

// GET /api/matches/<pk>/room/ — returns (lazily creating if needed) the
// match's MatchRoom and auto-joins the requester, so the chat WS consumer's
// membership guard passes immediately. `conversation` is the Conversation pk.
export interface MatchRoom {
  id: number;
  conversation: number;
  created_at: string;
}

export const getMatchRoom = async (matchId: number): Promise<MatchRoom> => {
  const { data } = await apiClient.get<MatchRoom>(`/api/matches/${matchId}/room/`);
  return data;
};

// DRF ValidationError bodies arrive as {"non_field_errors": ["..."]} or
// {"field": ["..."]} or a bare list. Flatten to the first human-readable
// string so permission rejections (e.g. the mutual-follow DM rule) surface
// with their real reason instead of a generic failure message.
export function extractApiError(err: unknown, fallback = 'Something went wrong.'): string {
  const data = (err as any)?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return String(data[0] ?? fallback);
  if (typeof data === 'object') {
    if (typeof data.error === 'string') return data.error;
    const first = Object.values(data)[0];
    if (Array.isArray(first)) return String(first[0] ?? fallback);
    if (typeof first === 'string') return first;
  }
  return fallback;
}
