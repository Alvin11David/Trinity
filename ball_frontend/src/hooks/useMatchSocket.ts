import { useEffect, useRef, useState } from 'react';
import { storage } from '../lib/storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// http(s)://host  ->  ws(s)://host  (matches ball/asgi.py's ws/matches/<id>/ route)
function wsBaseUrl() {
  return API_URL.replace(/^http/, 'ws').replace(/\/$/, '');
}

export interface LiveEvent {
  id: number;
  event_type: string;
  team: string;
  player: string;
  assist_player: string | null;
  minute: number;
  detail: string;
}

export interface LiveMatchState {
  home_score: number | null;
  away_score: number | null;
  minute: number | null;
  status: string;
}

/**
 * Subscribe to a match's live WebSocket group (Section 3.5's MatchRoom group,
 * reused per 36.4). Auth is via a `?token=` access JWT in the URL — RN's
 * WebSocket can't set headers, and the backend JWTAuthMiddleware (ball/ws_auth)
 * reads exactly that. On connect the consumer pushes the current match_state;
 * new goals/cards/subs arrive as match_event messages from sync_live_match_events.
 */
export function useMatchSocket(matchId: number, enabled: boolean) {
  const [connected, setConnected] = useState(false);
  const [liveState, setLiveState] = useState<LiveMatchState | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !matchId) return;
    let cancelled = false;
    let socket: WebSocket | null = null;

    (async () => {
      const token = await storage.getItem('access_token');
      if (cancelled) return;
      const url = `${wsBaseUrl()}/ws/matches/${matchId}/${token ? `?token=${encodeURIComponent(token)}` : ''}`;
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
        if (msg.type === 'match_state' && msg.match) {
          setLiveState({
            home_score: msg.match.home_score,
            away_score: msg.match.away_score,
            minute: msg.match.minute,
            status: msg.match.status,
          });
        } else if (msg.type === 'match_event') {
          if (msg.match) setLiveState((prev) => ({ ...(prev ?? { home_score: null, away_score: null, minute: null, status: 'live' }), ...msg.match }));
          if (msg.event) setEvents((prev) => (prev.some((x) => x.id === msg.event.id) ? prev : [msg.event, ...prev]));
        } else if (msg.type === 'match_update' && msg.match) {
          setLiveState((prev) => ({ ...(prev ?? { home_score: null, away_score: null, minute: null, status: 'live' }), ...msg.match }));
        }
      };
    })();

    return () => {
      cancelled = true;
      socket?.close();
      wsRef.current = null;
    };
  }, [matchId, enabled]);

  return { connected, liveState, events };
}
