import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { browsePlayers, type PlayerBrowseResult } from '../../../src/api/footballSearch';
import { useDebounce } from '../../../src/hooks/useDebounce';
import { useCountries } from '../../../src/hooks/useCountries';
import { getFlagUrl } from '../../../src/lib/flags';
import { useThemeColors } from '../../../src/hooks/useThemeColors';

const POSITION_FILTERS = ['All', 'Goalkeeper', 'Defender', 'Midfielder', 'Attacker'] as const;
type PositionFilter = (typeof POSITION_FILTERS)[number];

function formatEur(n: number | null | undefined): string {
  if (n == null) return '';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}

function playerHref(p: PlayerBrowseResult): Href {
  return `/(main)/(app)/player/${p.api_football_id}?name=${encodeURIComponent(p.name)}&photo=${encodeURIComponent(p.photo ?? '')}&teamId=${p.team_id ?? ''}&teamName=${encodeURIComponent(p.team_name ?? '')}&position=${encodeURIComponent(p.position ?? '')}&number=${p.number ?? ''}` as Href;
}

function PlayerCard({ player, nationalityFlag, c }: { player: PlayerBrowseResult; nationalityFlag: string | null; c: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  const mv = formatEur(player.market_value_eur);

  const posColors: Record<string, { bg: string; text: string; badgeBg: string; badgeText: string }> = {
    Goalkeeper: { bg: c.yellow100, text: c.yellow700, badgeBg: c.yellow100, badgeText: c.yellow700 },
    Defender: { bg: c.blue100, text: c.blue400, badgeBg: c.blue100, badgeText: c.blue400 },
    Midfielder: { bg: c.green100, text: c.green700, badgeBg: c.green100, badgeText: c.green700 },
    Attacker: { bg: c.red100, text: c.red700, badgeBg: c.red100, badgeText: c.red700 },
  };

  const pc = player.position ? posColors[player.position] : null;

  return (
    <Pressable
      onPress={() => router.push(playerHref(player))}
      style={{
        backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
        borderRadius: 12, padding: 16, marginBottom: 8,
      }}
    >
      {/* Photo + name + team + number */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ position: 'relative', flexShrink: 0 }}>
          {player.photo ? (
            <Image source={{ uri: player.photo }} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: c.gray100, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '700', color: c.muted }}>{player.name.charAt(0)}</Text>
            </View>
          )}
          {/* Injured indicator placeholder */}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }} numberOfLines={1}>{player.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 12, color: c.muted }} numberOfLines={1}>{player.team_name || '—'}</Text>
              </View>
            </View>
            {player.number != null && (
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: c.isDark ? '#052e16' : '#f0fdf4', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: c.isDark ? '#4ade80' : '#16a34a' }}>{player.number}</Text>
              </View>
            )}
          </View>

          {/* Badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {pc && (
              <View style={{ backgroundColor: c.isDark ? pc.bg + '30' : pc.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: pc.text }}>{player.position}</Text>
              </View>
            )}
            {player.nationality && (
              <View style={{ backgroundColor: c.gray100, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ fontSize: 10, fontWeight: '600', color: c.muted }}>{player.nationality}</Text>
              </View>
            )}
          </View>

          {/* Stats grid */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {player.age != null && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: c.muted }}>Age</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }}>{player.age}</Text>
              </View>
            )}
            {player.height && (
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: c.muted }}>Height</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.text }}>{player.height}</Text>
              </View>
            )}
            {mv && (
              <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="trending-up" size={11} color={c.muted} />
                  <Text style={{ fontSize: 11, color: c.muted }}>Value</Text>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.primary }}>{mv}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function PlayersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: countries } = useCountries();
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('All');
  const debounced = useDebounce(query, 250);
  const activePosition = positionFilter === 'All' ? undefined : positionFilter;
  const { data: players, isFetching } = useQuery({
    queryKey: ['players', 'browse', debounced, activePosition],
    queryFn: () => browsePlayers({ q: debounced || undefined, position: activePosition }),
    placeholderData: keepPreviousData,
  });
  const filtered = useMemo(() => {
    const list = players ?? [];
    if (positionFilter === 'All') return list;
    return list.filter((p) => p.position === positionFilter);
  }, [players, positionFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: c.text }}>Players</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginTop: 2 }}>Browse players, stats, and market values.</Text>
        </View>
      </View>

      {/* Search - Trinity style */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 8, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={16} color={c.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search players or teams…" placeholderTextColor={c.muted} style={{ flex: 1, fontSize: 14, color: c.text, paddingHorizontal: 8, paddingVertical: 10 }} returnKeyType="search" autoCorrect={false} />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Position pills - Trinity style */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        {POSITION_FILTERS.map((pos) => {
          const active = positionFilter === pos;
          return (
            <Pressable
              key={pos}
              onPress={() => setPositionFilter(pos)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                backgroundColor: active ? c.primary : 'transparent',
                borderColor: active ? c.primary : c.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : c.muted }}>{pos}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Count */}
      <Text style={{ fontSize: 12, color: c.muted, fontWeight: '500', paddingHorizontal: 16, marginBottom: 12 }}>
        {filtered.length} player{filtered.length !== 1 ? 's' : ''}
      </Text>

      {/* Grid */}
      {isFetching && !players ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      ) : filtered.length > 0 ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.api_football_id)}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <PlayerCard player={item} nationalityFlag={getFlagUrl(item.nationality, countries)} c={c} />
            </View>
          )}
        />
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
          <Text style={{ fontWeight: '600', color: c.muted }}>No players found</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>Try adjusting your search or filters.</Text>
        </View>
      )}
    </View>
  );
}
