import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, displayName } from '../feed/Avatar';
import type { ChatMessage, ChatMatchCard, GoalEventMetadata } from '../../api/chat';
import { useThemeColors } from '../../hooks/useThemeColors';

function timeLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function TeamLogo({ uri, size = 22 }: { uri: string | null; size?: number }) {
  if (!uri) return <View style={{ width: size, height: size }} />;
  return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" />;
}

// ---------------------------------------------------------------------------
// match_card — validated match reference, live-rendered card. Tap → Match Detail.
// ---------------------------------------------------------------------------
function MatchCardBody({ card, onLongPress }: { card: ChatMatchCard; onLongPress?: () => void }) {
  const showScore = card.status === 'live' || card.status === 'finished';
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/match/${card.id}` as Href)}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="rounded-xl border border-border bg-elevated p-3 gap-2"
      style={{ minWidth: 220 }}
    >
      {card.league ? (
        <Text className="text-textMuted text-[10px] uppercase tracking-wider">{card.league}</Text>
      ) : null}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <TeamLogo uri={card.home_team_logo} />
          <Text className="text-text text-sm flex-1" numberOfLines={1}>{card.home_team}</Text>
        </View>
        <Text className="text-text font-bold text-sm px-2">
          {showScore ? `${card.home_score ?? 0}` : ''}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2 flex-1">
          <TeamLogo uri={card.away_team_logo} />
          <Text className="text-text text-sm flex-1" numberOfLines={1}>{card.away_team}</Text>
        </View>
        <Text className="text-text font-bold text-sm px-2">
          {showScore ? `${card.away_score ?? 0}` : ''}
        </Text>
      </View>
      <Text className="text-textMuted text-xs">
        {card.status === 'live'
          ? `LIVE ${card.minute != null ? `· ${card.minute}'` : ''}`
          : card.status === 'finished'
            ? 'FT'
            : new Date(card.kickoff_time).toLocaleString()}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// prediction_card — match + Winnie prediction. Server rejects creation when the
// match has no prediction, so `prediction` is always present here.
// ---------------------------------------------------------------------------
function PredictionCardBody({
  card,
  onLongPress,
}: {
  card: NonNullable<ChatMessage['prediction_card']>;
  onLongPress?: () => void;
}) {
  const c = useThemeColors();
  const pred = card.prediction ?? {};
  // winnie_prediction's shape is owned by Winnie — render common fields
  // defensively, fall back to key:value lines for anything else scalar.
  const known = ['winner', 'predicted_winner', 'confidence', 'home_win', 'draw', 'away_win'];
  const extra = Object.entries(pred).filter(
    ([k, v]) => !known.includes(k) && (typeof v === 'string' || typeof v === 'number'),
  );
  const winner = (pred as any).winner ?? (pred as any).predicted_winner;
  const confidence = (pred as any).confidence;
  return (
    <View className="gap-2">
      <MatchCardBody card={card.match} onLongPress={onLongPress} />
      <View className="rounded-xl border border-primary/40 bg-primary/10 p-3 gap-1">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="sparkles" size={12} color={c.primary} />
          <Text className="text-primary text-[10px] font-bold uppercase tracking-wider">
            Winnie Prediction
          </Text>
        </View>
        {winner != null && (
          <Text className="text-text text-sm font-semibold">{String(winner)}</Text>
        )}
        {typeof confidence === 'number' && (
          <Text className="text-textSecondary text-xs">
            Confidence {Math.round(confidence * 100)}%
          </Text>
        )}
        {extra.slice(0, 4).map(([k, v]) => (
          <Text key={k} className="text-textSecondary text-xs">
            {k.replace(/_/g, ' ')}: {String(v)}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// poll — inline vote UI, live-computed counts, re-vote updates.
// ---------------------------------------------------------------------------
function PollBody({
  message,
  onVote,
  onLongPress,
}: {
  message: ChatMessage;
  onVote: (messageId: number, optionIndex: number) => void;
  onLongPress?: () => void;
}) {
  const poll = message.poll;
  if (!poll) return null;
  const total = poll.total_votes || 0;
  return (
    <View className="gap-1.5" style={{ minWidth: 220 }}>
      {message.content ? (
        <Pressable onLongPress={onLongPress} delayLongPress={350}>
          <Text className="text-text text-sm mb-1">{message.content}</Text>
        </Pressable>
      ) : null}
      {poll.options.map((option, i) => {
        const count = poll.counts[i] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const mine = poll.user_vote === i;
        return (
          <Pressable
            key={i}
            onPress={() => onVote(message.id, i)}
            onLongPress={onLongPress}
            delayLongPress={350}
            className={`rounded-lg border p-2 overflow-hidden ${
              mine ? 'border-primary' : 'border-border'
            }`}
          >
            <View
              className={`absolute left-0 top-0 bottom-0 ${mine ? 'bg-primary/25' : 'bg-elevated'}`}
              style={{ width: `${pct}%` }}
            />
            <View className="flex-row items-center justify-between">
              <Text className={`text-sm ${mine ? 'text-primary font-semibold' : 'text-text'}`}>
                {option}
              </Text>
              <Text className="text-textSecondary text-xs">{count}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text className="text-textMuted text-[11px]">
        {total} vote{total === 1 ? '' : 's'}
        {poll.user_vote != null ? ' · tap another option to change your vote' : ''}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// goal_event — system-authored (the `ball` account). Rendered as a centered
// system card, deliberately unlike a human bubble: no avatar, no reply
// affordance, score/scorer/minute pulled from metadata.
// ---------------------------------------------------------------------------
export function GoalEventCard({
  metadata,
  createdAt,
}: {
  metadata: GoalEventMetadata;
  createdAt: string;
}) {
  return (
    <View className="items-center my-2 px-6">
      <View className="rounded-xl border border-goal/40 bg-goal/10 px-4 py-2.5 items-center gap-0.5 w-full">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-base">⚽</Text>
          <Text className="text-text font-bold text-sm">
            {metadata.scorer} {metadata.minute}'
          </Text>
        </View>
        <Text className="text-textSecondary text-xs">{metadata.team}</Text>
        {metadata.assist ? (
          <Text className="text-textMuted text-[11px]">Assist: {metadata.assist}</Text>
        ) : null}
        {metadata.home_score != null && metadata.away_score != null && (
          <Text className="text-goal font-bold text-sm">
            {metadata.home_score} – {metadata.away_score}
          </Text>
        )}
        <Text className="text-textMuted text-[10px]">{timeLabel(createdAt)}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher — five distinct treatments, not one generic bubble.
// ---------------------------------------------------------------------------
export function MessageBubble({
  message,
  isOwn,
  showSender,
  onVotePoll,
  onLongPress,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showSender: boolean; // sender name shown in groups/channels, not DMs
  onVotePoll: (messageId: number, optionIndex: number) => void;
  onLongPress?: () => void; // pin (undefined when the viewer can't pin here)
}) {
  if (message.message_type === 'goal_event') {
    // System message — no reply/pin affordance (and match rooms can't pin).
    const meta = (message.metadata ?? {}) as unknown as GoalEventMetadata;
    return <GoalEventCard metadata={meta} createdAt={message.created_at} />;
  }

  let body: React.ReactNode;
  switch (message.message_type) {
    case 'match_card':
      body = message.match_card ? (
        <MatchCardBody card={message.match_card} onLongPress={onLongPress} />
      ) : (
        <Text className="text-textMuted text-sm italic">Match unavailable</Text>
      );
      break;
    case 'prediction_card':
      body = message.prediction_card ? (
        <PredictionCardBody card={message.prediction_card} onLongPress={onLongPress} />
      ) : (
        <Text className="text-textMuted text-sm italic">Prediction unavailable</Text>
      );
      break;
    case 'poll':
      body = <PollBody message={message} onVote={onVotePoll} onLongPress={onLongPress} />;
      break;
    default:
      body = (
        <Pressable onLongPress={onLongPress} delayLongPress={350}>
          <Text className="text-text text-[15px] leading-5">{message.content}</Text>
        </Pressable>
      );
  }

  const isCard = message.message_type !== 'text';
  return (
    <View className={`flex-row px-3 my-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <View className="mr-2 mt-auto">
          <Avatar author={message.sender} size={26} />
        </View>
      )}
      <View
        className={`max-w-[80%] rounded-2xl px-3 py-2 ${
          isCard
            ? 'bg-transparent px-0 py-0'
            : isOwn
              ? 'bg-primary/20 border border-primary/30'
              : 'bg-surface border border-border'
        }`}
      >
        {showSender && !isOwn && (
          <Text className="text-primary text-xs font-semibold mb-0.5">
            {displayName(message.sender)}
          </Text>
        )}
        {body}
        <Text className={`text-textMuted text-[10px] mt-1 ${isOwn ? 'text-right' : ''}`}>
          {timeLabel(message.created_at)}
        </Text>
      </View>
    </View>
  );
}
