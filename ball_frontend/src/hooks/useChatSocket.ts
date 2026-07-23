import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { storage } from '../lib/storage';
import { chatKeys } from './useChat';
import { getMessage, type ChatMessage, type MessageType } from '../api/chat';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

function wsBaseUrl() {
  return API_URL.replace(/^http/, 'ws').replace(/\/$/, '');
}

// The consumer's chat_message group event — flattened, NOT the REST
// MessageSerializer shape (no nested match_card/prediction_card/poll).
export interface LiveChatMessage {
  message_id: number;
  content: string;
  message_type: MessageType;
  match_id: number | null;
  metadata: Record<string, unknown> | null;
  sender_id: number;
  sender_username: string;
  sender_avatar: string | null;
  created_at: string;
}

export interface TypingUser {
  user_id: number;
  username: string;
}

const TYPING_EXPIRY_MS = 4000;

/**
 * Bidirectional per-conversation chat socket (ws/chat/<id>/). Same JWT
 * `?token=` connection pattern as useMatchSocket, but this hook also SENDS —
 * exactly the backend's strict contract, nothing else:
 *   {type: 'typing', is_typing}                            — ephemeral
 *   {type: 'message', message_type, content, match_id, metadata}
 * The backend rejects anything else with an {error: ...} frame; those frames
 * (including validation failures on sends) surface via `lastError` — never
 * assume a send succeeded just because the socket accepted the write.
 *
 * Incoming chat_message events: text/goal_event carry everything needed to
 * render and are appended to `liveMessages`; card/poll types need the nested
 * REST payloads (match_card/prediction_card/poll), so those trigger a refetch
 * of the messages query instead of an optimistic append.
 */
export function useChatSocket(conversationId: number, currentUserId: number | undefined, enabled = true) {
  const [connected, setConnected] = useState(false);
  const [liveMessages, setLiveMessages] = useState<LiveChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || !conversationId) return;
    let cancelled = false;
    let socket: WebSocket | null = null;

    (async () => {
      const token = await storage.getItem('access_token');
      if (cancelled) return;
      const url = `${wsBaseUrl()}/ws/chat/${conversationId}/${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => !cancelled && setConnected(true);
      socket.onclose = () => !cancelled && setConnected(false);
      socket.onerror = () => !cancelled && setConnected(false);
      socket.onmessage = (e) => {
        if (cancelled) return;
        let msg: any;
        try {
          msg = JSON.parse(e.data as string);
        } catch {
          return;
        }

        // Error frames have no `type` key — just {error: string}.
        if (typeof msg.error === 'string') {
          setLastError(msg.error);
          return;
        }

        if (msg.type === 'chat_message') {
          const needsRestPayload =
            msg.message_type === 'match_card' ||
            msg.message_type === 'prediction_card' ||
            msg.message_type === 'poll';
          if (needsRestPayload) {
            // Fetch ONLY this message (its nested render payload isn't in the
            // WS event) and splice it into the cached thread — no full-list
            // reload, so a busy card/poll conversation can't trigger a refetch
            // storm.
            getMessage(conversationId, msg.message_id)
              .then((full) => {
                qc.setQueryData<ChatMessage[]>(chatKeys.messages(conversationId), (old) => {
                  if (!old) return old;
                  if (old.some((m) => m.id === full.id)) {
                    return old.map((m) => (m.id === full.id ? full : m));
                  }
                  return [...old, full];
                });
              })
              .catch(() => {
                /* transient fetch failure — the message still lands on next
                   full open; don't fall back to a storm-prone invalidate. */
              });
          } else {
            setLiveMessages((prev) =>
              prev.some((m) => m.message_id === msg.message_id)
                ? prev
                : [
                    ...prev,
                    {
                      message_id: msg.message_id,
                      content: msg.content,
                      message_type: msg.message_type,
                      match_id: msg.match_id,
                      metadata: msg.metadata,
                      sender_id: msg.sender_id,
                      sender_username: msg.sender_username,
                      sender_avatar: msg.sender_avatar,
                      created_at: msg.created_at,
                    },
                  ],
            );
          }
          // A new message clears that sender's typing indicator immediately.
          setTypingUsers((prev) => prev.filter((t) => t.user_id !== msg.sender_id));
        } else if (msg.type === 'typing_indicator') {
          if (msg.user_id === currentUserId) return; // never show your own
          const timers = typingTimers.current;
          const existing = timers.get(msg.user_id);
          if (existing) clearTimeout(existing);
          if (msg.is_typing) {
            setTypingUsers((prev) =>
              prev.some((t) => t.user_id === msg.user_id)
                ? prev
                : [...prev, { user_id: msg.user_id, username: msg.username }],
            );
            timers.set(
              msg.user_id,
              setTimeout(() => {
                setTypingUsers((prev) => prev.filter((t) => t.user_id !== msg.user_id));
                timers.delete(msg.user_id);
              }, TYPING_EXPIRY_MS),
            );
          } else {
            setTypingUsers((prev) => prev.filter((t) => t.user_id !== msg.user_id));
            timers.delete(msg.user_id);
          }
        }
      };
    })();

    return () => {
      cancelled = true;
      socket?.close();
      wsRef.current = null;
      typingTimers.current.forEach((t) => clearTimeout(t));
      typingTimers.current.clear();
      setLiveMessages([]);
      setTypingUsers([]);
      setLastError(null);
      setConnected(false);
    };
  }, [conversationId, enabled, currentUserId, qc]);

  const sendChatMessage = useCallback(
    (payload: {
      message_type?: MessageType;
      content?: string;
      match_id?: number | null;
      metadata?: Record<string, unknown> | null;
    }): boolean => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return false;
      socket.send(
        JSON.stringify({
          type: 'message',
          message_type: payload.message_type ?? 'text',
          content: payload.content ?? '',
          match_id: payload.match_id ?? null,
          metadata: payload.metadata ?? null,
        }),
      );
      return true;
    },
    [],
  );

  const sendTyping = useCallback((isTyping: boolean) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: 'typing', is_typing: isTyping }));
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  return { connected, liveMessages, typingUsers, lastError, clearError, sendChatMessage, sendTyping };
}
