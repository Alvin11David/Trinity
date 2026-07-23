import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { MatchCard } from '../../api/feed';
import { useThemeColors } from '../../hooks/useThemeColors';

function Crest({ uri }: { uri: string | null }) {
  if (!uri) return <View className="w-9 h-9 rounded-full bg-elevated" />;
  return <Image source={{ uri }} style={{ width: 36, height: 36 }} contentFit="contain" />;
}

// match_object recap (CLAUDE.md 36.2): final score + goal scorers, static.
export function MatchObjectCard({ card }: { card: MatchCard }) {
  const router = useRouter();
  const c = useThemeColors();
  const finished = card.status === 'finished' || card.status === 'live';
  const homeGoals = card.goal_scorers?.filter((g) => g.team === card.home_team) ?? [];
  const awayGoals = card.goal_scorers?.filter((g) => g.team === card.away_team) ?? [];

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push(`/(main)/(app)/match/${card.id}` as Href)}
      className="mt-3 rounded-2xl border border-border bg-elevated overflow-hidden"
    >
      {/* header strip */}
      <View className="flex-row items-center justify-between px-4 pt-3">
        <Text className="text-textMuted text-[11px] font-medium uppercase tracking-wide" numberOfLines={1}>
          {card.league ?? 'Match'}
        </Text>
        <View className="flex-row items-center gap-1">
          <View className="w-1.5 h-1.5 rounded-full bg-primary" />
          <Text className="text-textSecondary text-[11px] font-semibold">
            {card.status === 'live' ? `${card.minute ?? ''}'` : 'FT'}
          </Text>
        </View>
      </View>

      {/* scoreline */}
      <View className="flex-row items-center px-4 py-3">
        <View className="flex-1 flex-row items-center gap-2">
          <Crest uri={card.home_team_logo} />
          <Text className="text-text text-sm font-semibold flex-shrink" numberOfLines={1}>
            {card.home_team}
          </Text>
        </View>
        <View className="px-3">
          <Text className="text-text text-2xl font-bold tabular-nums">
            {card.home_score ?? 0} <Text className="text-textMuted">–</Text> {card.away_score ?? 0}
          </Text>
        </View>
        <View className="flex-1 flex-row items-center justify-end gap-2">
          <Text className="text-text text-sm font-semibold flex-shrink text-right" numberOfLines={1}>
            {card.away_team}
          </Text>
          <Crest uri={card.away_team_logo} />
        </View>
      </View>

      {/* scorers */}
      {finished && (homeGoals.length > 0 || awayGoals.length > 0) && (
        <View className="flex-row px-4 pb-3 gap-3">
          <View className="flex-1">
            {homeGoals.map((g, i) => (
              <View key={i} className="flex-row items-center gap-1 mb-0.5">
                <Ionicons name="football" size={11} color={c.primary} />
                <Text className="text-textSecondary text-[11px]" numberOfLines={1}>
                  {g.player} {g.minute}'
                </Text>
              </View>
            ))}
          </View>
          <View className="flex-1 items-end">
            {awayGoals.map((g, i) => (
              <View key={i} className="flex-row items-center gap-1 mb-0.5">
                <Text className="text-textSecondary text-[11px] text-right" numberOfLines={1}>
                  {g.minute}' {g.player}
                </Text>
                <Ionicons name="football" size={11} color={c.primary} />
              </View>
            ))}
          </View>
        </View>
      )}

      {card.has_prediction && (
        <View className="flex-row items-center gap-1 border-t border-border px-4 py-2">
          <Ionicons name="sparkles" size={12} color={c.primary} />
          <Text className="text-primary text-[11px] font-medium">Winnie prediction available</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
