import { View, Text } from 'react-native';
import { useMatchSocket, type LiveEvent } from '../../hooks/useMatchSocket';

const EVENT_EMOJI: Record<string, string> = {
  goal: '⚽',
  yellow_card: '🟨',
  red_card: '🟥',
  substitution: '🔁',
  var: '📺',
  other: '•',
};

function EventLine({ event, homeTeam }: { event: LiveEvent; homeTeam: string }) {
  const isHome = event.team === homeTeam;
  return (
    <View className={`flex-row items-center gap-2 py-1 ${isHome ? '' : 'flex-row-reverse'}`}>
      <Text className="text-textMuted text-[11px] w-7 tabular-nums">{event.minute}'</Text>
      <Text style={{ fontSize: 13 }}>{EVENT_EMOJI[event.event_type] ?? '•'}</Text>
      <Text className="text-text text-[12px]" numberOfLines={1}>
        {event.player}
        {event.assist_player ? ` (${event.assist_player})` : ''}
      </Text>
    </View>
  );
}

/**
 * Real-time live panel (Step 8 / Section 34's "true live view"). Renders inside
 * Match Detail when the match is live — updating score + a live event feed fed
 * by the match WebSocket. Falls back to the REST-fetched values until the socket
 * delivers state.
 */
export function LiveMatchPanel({
  matchId,
  homeTeam,
  fallbackHome,
  fallbackAway,
  fallbackMinute,
}: {
  matchId: number;
  homeTeam: string;
  fallbackHome: number | null;
  fallbackAway: number | null;
  fallbackMinute: number | null;
}) {
  const { connected, liveState, events } = useMatchSocket(matchId, true);

  const home = liveState?.home_score ?? fallbackHome;
  const away = liveState?.away_score ?? fallbackAway;
  const minute = liveState?.minute ?? fallbackMinute;

  return (
    <View className="mx-4 mb-1 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <View className={`w-2 h-2 rounded-full ${connected ? 'bg-redCard' : 'bg-textMuted'}`} />
          <Text className="text-redCard text-[11px] font-bold tracking-wide">LIVE</Text>
          <Text className="text-textSecondary text-[11px]">· {minute ?? 0}'</Text>
        </View>
        <Text className="text-text text-base font-bold tabular-nums">
          {home ?? 0} – {away ?? 0}
        </Text>
      </View>

      {events.length > 0 && (
        <View className="mt-2 border-t border-primary/20 pt-2">
          {events.slice(0, 6).map((e) => (
            <EventLine key={e.id} event={e} homeTeam={homeTeam} />
          ))}
        </View>
      )}

      {!connected && (
        <Text className="text-textMuted text-[10px] mt-1">Connecting to live updates…</Text>
      )}
    </View>
  );
}
