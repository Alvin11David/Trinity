import { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';
import {
  usePlayerProfile,
  usePlayerMatchHistory,
  usePlayerMarketValueHistory,
  usePlayerTransfers,
} from '../../../../src/hooks/usePlayerDetail';
import { useCountries } from '../../../../src/hooks/useCountries';
import { getFlagUrl } from '../../../../src/lib/flags';
import type {
  PlayerStatistics,
  PlayerMatchHistoryItem,
  PlayerProfile,
  PlayerMarketValuePoint,
  PlayerTransferItem,
} from '../../../../src/api/playerDetail';

type Tab = 'profile' | 'matches' | 'stats';

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'matches', label: 'Matches' },
  { key: 'stats', label: 'Stats' },
];

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function TeamCrest({ uri, size = 22 }: { uri: string | null; size?: number }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size }} className="mr-2" resizeMode="contain" />
  ) : (
    <View style={{ width: size, height: size }} className="mr-2 bg-elevated rounded-full" />
  );
}

function sumField(entries: PlayerStatistics[], extractor: (e: PlayerStatistics) => number | null | undefined): number {
  return entries.reduce((sum, e) => sum + (extractor(e) ?? 0), 0);
}

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 bg-surface border border-border rounded-lg px-3 py-3 items-center">
      <Text className="text-textSecondary text-xs mb-1 text-center" numberOfLines={1}>
        {label}
      </Text>
      <Text className="text-text text-lg font-bold">{value}</Text>
    </View>
  );
}

type StatFilter = 'total' | 'league' | 'cup' | 'national';

const STAT_FILTERS: { key: StatFilter; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'league', label: 'League' },
  { key: 'cup', label: 'Cup' },
  { key: 'national', label: 'National' },
];

// Heuristic, not authoritative — API-Football's player statistics entries
// don't carry a competition "type" field directly. An entry counts as
// National if its team differs from the player's actual club (i.e. it's a
// country-duty stats line, not a club one); otherwise Cup if the
// competition name matches common cup/knockout naming, else League.
const CUP_NAME_KEYWORDS = ['cup', 'shield', 'trophy', 'champions league', 'europa', 'conference', 'super cup'];

function classifyEntry(entry: PlayerStatistics, clubTeamId: number | undefined): Exclude<StatFilter, 'total'> {
  if (clubTeamId != null && entry.team?.id !== clubTeamId) return 'national';
  const name = (entry.league?.name || '').toLowerCase();
  if (CUP_NAME_KEYWORDS.some((kw) => name.includes(kw))) return 'cup';
  return 'league';
}

function buildQuickStats(entries: PlayerStatistics[]) {
  const appearances = sumField(entries, (e) => e.games?.appearences);
  const minutes = sumField(entries, (e) => e.games?.minutes);
  return {
    appearances,
    starts: sumField(entries, (e) => e.games?.lineups),
    minsPerGame: appearances > 0 ? Math.round(minutes / appearances) : 0,
    goals: sumField(entries, (e) => e.goals?.total),
    assists: sumField(entries, (e) => e.goals?.assists),
  };
}

function buildFullBreakdown(entries: PlayerStatistics[]) {
  return [
    {
      title: 'Attacking',
      tiles: [
        { label: 'Goals', value: sumField(entries, (e) => e.goals?.total) },
        { label: 'Assists', value: sumField(entries, (e) => e.goals?.assists) },
        { label: 'Shots', value: sumField(entries, (e) => e.shots?.total) },
        { label: 'Shots on Target', value: sumField(entries, (e) => e.shots?.on) },
      ],
    },
    {
      title: 'Passing',
      tiles: [
        { label: 'Passes', value: sumField(entries, (e) => e.passes?.total) },
        { label: 'Key Passes', value: sumField(entries, (e) => e.passes?.key) },
      ],
    },
    {
      title: 'Defending',
      tiles: [
        { label: 'Tackles', value: sumField(entries, (e) => e.tackles?.total) },
        { label: 'Interceptions', value: sumField(entries, (e) => e.tackles?.interceptions) },
        { label: 'Duels Won', value: sumField(entries, (e) => e.duels?.won) },
      ],
    },
    {
      title: 'Discipline',
      tiles: [
        { label: 'Yellow Cards', value: sumField(entries, (e) => e.cards?.yellow) },
        { label: 'Red Cards', value: sumField(entries, (e) => e.cards?.red) },
        { label: 'Fouls Committed', value: sumField(entries, (e) => e.fouls?.committed) },
      ],
    },
    {
      title: 'Penalties',
      tiles: [
        { label: 'Won', value: sumField(entries, (e) => e.penalty?.won) },
        { label: 'Scored', value: sumField(entries, (e) => e.penalty?.scored) },
        { label: 'Missed', value: sumField(entries, (e) => e.penalty?.missed) },
      ],
    },
  ];
}

function CompetitionStatCard({
  headerLeft,
  headerRight,
  entries,
}: {
  headerLeft: string;
  headerRight: string;
  entries: PlayerStatistics[];
}) {
  const [expanded, setExpanded] = useState(false);
  const quick = buildQuickStats(entries);
  const breakdown = buildFullBreakdown(entries);

  return (
    <View className="bg-surface border border-border rounded-lg mb-2 mx-4 overflow-hidden">
      <View className="flex-row items-center justify-between px-4 py-2 bg-elevated">
        <Text className="text-textSecondary text-xs" numberOfLines={1}>
          {headerLeft}
        </Text>
        <Text className="text-textSecondary text-xs" numberOfLines={1}>
          {headerRight}
        </Text>
      </View>

      <View className="flex-row px-4 pt-3 gap-2">
        <StatTile label="Appearances" value={quick.appearances} />
        <StatTile label="Starts" value={quick.starts} />
        <StatTile label="Mins pg" value={quick.minsPerGame} />
        <StatTile label="Goals" value={quick.goals} />
      </View>
      <View className="flex-row px-4 py-3 gap-2">
        <StatTile label="Assists" value={quick.assists} />
        <View className="flex-1" />
        <View className="flex-1" />
        <View className="flex-1" />
      </View>

      {expanded && (
        <View className="px-4 pb-3 gap-2">
          {breakdown.map((section) => (
            <View key={section.title}>
              <Text className="text-text text-xs font-bold mb-2 mt-1">{section.title}</Text>
              {chunkPairs(section.tiles).map((row, i) => (
                <View key={i} className="flex-row gap-2 mb-2">
                  {row.map((tile) => (
                    <StatTile key={tile.label} label={tile.label} value={tile.value} />
                  ))}
                  {row.length === 1 && <View className="flex-1" />}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity onPress={() => setExpanded((v) => !v)} className="items-center py-2 border-t border-border">
        <Text className="text-textSecondary text-xs">{expanded ? '▲ Close' : '▼ Open'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function resultColorClass(teamScore: number | null, opponentScore: number | null): string {
  if (teamScore == null || opponentScore == null) return 'bg-textMuted';
  if (teamScore > opponentScore) return 'bg-primary';
  if (teamScore < opponentScore) return 'bg-redCard';
  return 'bg-textMuted';
}

function MatchHistoryHeader() {
  return (
    <View className="flex-row items-center bg-elevated border border-border rounded-lg px-3 py-2 mb-2 mx-4">
      <Text className="text-textSecondary text-[10px] font-semibold flex-1">Date / Opponent</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-8 text-center">Min</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-6 text-center">G</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-6 text-center">A</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-10 text-center">Cards</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-10 text-center">Rate</Text>
    </View>
  );
}

function MatchHistoryRow({ item }: { item: PlayerMatchHistoryItem }) {
  const isHome = item.team_id === item.match_summary.home_team_id;
  const opponentName = isHome ? item.match_summary.away_team : item.match_summary.home_team;
  const opponentLogo = isHome ? item.match_summary.away_team_logo : item.match_summary.home_team_logo;
  const teamScore = isHome ? item.match_summary.home_score : item.match_summary.away_score;
  const opponentScore = isHome ? item.match_summary.away_score : item.match_summary.home_score;
  const hasScore = teamScore != null && opponentScore != null;
  // A squad member with no recorded minutes wasn't used in the match at all
  // (API-Football still includes unused subs in /fixtures/players).
  const onBench = item.minutes == null;

  return (
    <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-2.5 mb-2 mx-4">
      <View className="flex-1 pr-2">
        <View className="flex-row items-center mb-1">
          <TeamCrest uri={opponentLogo} size={18} />
          <Text className="text-text text-xs flex-1" numberOfLines={1}>
            {isHome ? 'vs' : '@'} {opponentName}
          </Text>
          {hasScore && (
            <View className={`px-1.5 py-0.5 rounded ${resultColorClass(teamScore, opponentScore)}`}>
              <Text className="text-background text-[10px] font-bold">
                {teamScore}-{opponentScore}
              </Text>
            </View>
          )}
        </View>
        <Text className="text-textMuted text-[10px]" numberOfLines={1}>
          {formatKickoff(item.match_summary.kickoff_time)} · {item.match_summary.league_name}
        </Text>
      </View>

      {onBench ? (
        <Text className="text-textMuted text-[10px] w-32 text-center">On the bench</Text>
      ) : (
        <>
          <Text className="text-textSecondary text-xs w-8 text-center">{item.minutes}'</Text>
          <Text className="text-text text-xs w-6 text-center">{item.goals || '-'}</Text>
          <Text className="text-text text-xs w-6 text-center">{item.assists || '-'}</Text>
          <View className="w-10 items-center">
            {item.red_cards > 0 ? (
              <View className="w-3 h-4 bg-redCard rounded-sm" />
            ) : item.yellow_cards > 0 ? (
              <View className="w-3 h-4 bg-yellowCard rounded-sm" />
            ) : (
              <Text className="text-textMuted text-xs">-</Text>
            )}
          </View>
          <Text className="text-yellowCard text-xs font-bold w-10 text-center">
            {item.rating ? Number(item.rating).toFixed(1) : '-'}
          </Text>
        </>
      )}
    </View>
  );
}

function formatEur(n: number | null | undefined): string {
  if (n == null) return '-';
  if (n >= 1e9) return `€${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `€${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `€${Math.round(n / 1e3)}K`;
  return `€${n}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function TMRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-textSecondary text-xs">{label}</Text>
      <Text className="text-text text-xs font-semibold" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// Transfermarkt market value + contract/foot/agent. Only rendered when the TM
// sync has matched this player (market_value_eur / transfermarkt_id non-null).
function MarketValueCard({ profile }: { profile: PlayerProfile }) {
  const mv = profile.market_value_eur;
  const prev = profile.previous_value_eur;
  if (mv == null && profile.transfermarkt_id == null) return null;
  const delta = mv != null && prev != null ? mv - prev : null;

  return (
    <View className="bg-surface border border-border rounded-lg px-4 py-3">
      <Text className="text-textSecondary text-xs mb-1">Market value</Text>
      <View className="flex-row items-end gap-2">
        <Text className="text-text text-2xl font-bold">{formatEur(mv)}</Text>
        {delta != null && delta !== 0 && (
          <Text className={`text-xs font-semibold mb-1 ${delta > 0 ? 'text-primary' : 'text-redCard'}`}>
            {delta > 0 ? '▲' : '▼'} {formatEur(Math.abs(delta))}
          </Text>
        )}
      </View>
      <View className="mt-2 gap-1">
        {profile.contract_until && <TMRow label="Contract until" value={profile.contract_until} />}
        {profile.preferred_foot && <TMRow label="Preferred foot" value={capitalize(profile.preferred_foot)} />}
        {profile.agent && <TMRow label="Agent" value={profile.agent} />}
      </View>
      <Text className="text-textMuted text-[10px] mt-2">via Transfermarkt</Text>
    </View>
  );
}

// Dependency-free market-value sparkline — scaled bars, no chart library.
function MVSparkline({ points }: { points: PlayerMarketValuePoint[] }) {
  if (points.length < 2) return null;
  const values = points.map((p) => p.value_eur);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <View className="bg-surface border border-border rounded-lg px-4 py-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-textSecondary text-xs">Market value history</Text>
        <Text className="text-primary text-xs font-semibold">peak {formatEur(max)}</Text>
      </View>
      <View className="flex-row items-end" style={{ height: 56 }}>
        {points.map((p, i) => (
          <View
            key={i}
            className="flex-1 bg-primary rounded-sm"
            style={{ height: 6 + ((p.value_eur - min) / range) * 46, marginHorizontal: 0.5 }}
          />
        ))}
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-textMuted text-[10px]">{points[0].date?.slice(0, 4)}</Text>
        <Text className="text-textMuted text-[10px]">{points[points.length - 1].date?.slice(0, 4)}</Text>
      </View>
    </View>
  );
}

function formatFee(feeEur: number | null): string {
  if (feeEur == null) return '—';
  if (feeEur === 0) return 'Free';
  return formatEur(feeEur);
}

// Transfermarkt career transfer history. Club names/logos resolved server-side.
function TransfersCard({ transfers }: { transfers: PlayerTransferItem[] }) {
  if (transfers.length === 0) return null;
  return (
    <View className="bg-surface border border-border rounded-lg px-4 py-3">
      <Text className="text-textSecondary text-xs mb-2">Transfer history</Text>
      {transfers.map((t, i) => (
        <View
          key={i}
          className={`flex-row items-center py-2 ${i > 0 ? 'border-t border-border' : ''}`}
        >
          <View className="flex-1 flex-row items-center">
            <TeamCrest uri={t.from_club_logo} size={16} />
            <Text className="text-text text-xs flex-shrink" numberOfLines={1}>
              {t.from_club ?? `#${t.from_tm_club_id ?? '?'}`}
            </Text>
            <Text className="text-textMuted text-xs mx-1">→</Text>
            <TeamCrest uri={t.to_club_logo} size={16} />
            <Text className="text-text text-xs flex-shrink" numberOfLines={1}>
              {t.to_club ?? `#${t.to_tm_club_id ?? '?'}`}
            </Text>
          </View>
          <View className="items-end ml-2">
            <Text className="text-primary text-xs font-semibold">{formatFee(t.fee_eur)}</Text>
            <Text className="text-textMuted text-[10px]">{t.date?.slice(0, 4) ?? ''}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PlayerDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name?: string;
    photo?: string;
    teamId?: string;
    teamName?: string;
    position?: string;
    number?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  const playerId = Number(params.id);
  const fallbackName = params.name || 'Player';
  const fallbackPhoto = params.photo || null;
  const fallbackTeamId = params.teamId ? Number(params.teamId) : undefined;
  const fallbackTeamName = params.teamName || '';
  const fallbackPosition = params.position || null;
  const fallbackNumber = params.number ? Number(params.number) : null;

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [statFilter, setStatFilter] = useState<StatFilter>('total');

  const { data: profile, isLoading: profileLoading } = usePlayerProfile(playerId);
  const { data: matchHistory, isLoading: historyLoading } = usePlayerMatchHistory(playerId);
  const { data: mvHistory } = usePlayerMarketValueHistory(playerId);
  const { data: transfers } = usePlayerTransfers(playerId);
  const { data: countries } = useCountries();
  const nationalityFlag = getFlagUrl(profile?.nationality, countries);

  const playerName = profile?.name || fallbackName;
  const playerPhoto = profile?.photo || fallbackPhoto;
  const teamId = profile?.team_id ?? fallbackTeamId;
  const teamName = profile?.team_name || fallbackTeamName;
  const position = profile?.position || fallbackPosition;
  const number = profile?.number ?? fallbackNumber;

  // Aggregate across every competition entry for the player's current team
  // this season (same convention as Team Detail's Key Player computation —
  // a player's `statistics` array is scoped per-competition, so summing
  // avoids arbitrarily picking one competition's entry).
  const teamEntries = useMemo(() => {
    if (!profile?.statistics) return [];
    return profile.statistics.filter((e) => e.team?.id === teamId);
  }, [profile, teamId]);

  const seasonSnapshot = useMemo(() => {
    if (teamEntries.length === 0) return null;
    return {
      appearances: sumField(teamEntries, (e) => e.games?.appearences),
      goals: sumField(teamEntries, (e) => e.goals?.total),
      assists: sumField(teamEntries, (e) => e.goals?.assists),
    };
  }, [teamEntries]);

  // Individual (non-aggregated) entries for the currently-selected filter —
  // each renders as its own CompetitionStatCard. "Total" instead shows one
  // card summing every entry, handled separately at render time.
  const filteredEntries = useMemo(() => {
    if (!profile?.statistics || statFilter === 'total') return [];
    return profile.statistics.filter((e) => classifyEntry(e, profile.team_id) === statFilter);
  }, [profile, statFilter]);

  return (
    <View className="flex-1 bg-background">
      <View
        style={{ paddingTop: insets.top + 8 }}
        className="flex-row items-center px-4 pb-3 border-b border-border"
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3" hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text className="text-text text-lg font-bold flex-1" numberOfLines={1}>
          {playerName}
        </Text>
      </View>

      <View className="flex-row items-center px-4 py-4 border-b border-border">
        {playerPhoto ? (
          <Image source={{ uri: playerPhoto }} className="w-16 h-16 rounded-full" resizeMode="cover" />
        ) : (
          <View className="w-16 h-16 rounded-full bg-elevated items-center justify-center">
            <Text className="text-text text-lg font-bold">{playerName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View className="flex-1 ml-3">
          <Text className="text-text text-lg font-bold" numberOfLines={1}>
            {playerName}
          </Text>
          <Text className="text-textSecondary text-xs mt-0.5" numberOfLines={1}>
            {[position, number != null ? `#${number}` : null, teamName].filter(Boolean).join(' · ')}
          </Text>
          {profileLoading ? (
            <ActivityIndicator color={c.primary} size="small" className="mt-1 self-start" />
          ) : (
            seasonSnapshot && (
              <View className="flex-row gap-3 mt-1">
                <Text className="text-primary text-xs font-semibold">{seasonSnapshot.appearances} apps</Text>
                <Text className="text-primary text-xs font-semibold">{seasonSnapshot.goals} goals</Text>
                <Text className="text-primary text-xs font-semibold">{seasonSnapshot.assists} assists</Text>
              </View>
            )
          )}
        </View>
      </View>

      <View className="flex-row px-4 py-3 gap-2">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg items-center border ${
                isActive ? 'bg-primary border-primary' : 'bg-surface border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${isActive ? 'text-background' : 'text-textSecondary'}`}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'profile' &&
        (profileLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <ScrollView
            className="px-4"
            contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {profile && <MarketValueCard profile={profile} />}
            {mvHistory && mvHistory.length > 1 && <MVSparkline points={mvHistory} />}
            <View className="flex-row items-center justify-between bg-surface border border-border rounded-lg px-4 py-3">
              <Text className="text-textSecondary text-sm">Nationality</Text>
              <View className="flex-row items-center gap-2">
                {nationalityFlag && (
                  <Image source={{ uri: nationalityFlag }} className="w-5 h-3.5 rounded-sm" resizeMode="cover" />
                )}
                <Text className="text-text text-sm font-bold">{profile?.nationality ?? '-'}</Text>
              </View>
            </View>
            {[
              { label: 'Age', value: profile?.age ?? '-' },
              { label: 'Height', value: profile?.height ?? '-' },
              { label: 'Weight', value: profile?.weight ?? '-' },
              { label: 'Birth Date', value: profile?.birth_date ?? '-' },
              { label: 'Birth Place', value: profile?.birth_place ?? '-' },
            ].map((row) => (
              <View
                key={row.label}
                className="flex-row items-center justify-between bg-surface border border-border rounded-lg px-4 py-3"
              >
                <Text className="text-textSecondary text-sm">{row.label}</Text>
                <Text className="text-text text-sm font-bold">{row.value}</Text>
              </View>
            ))}
            {transfers && <TransfersCard transfers={transfers} />}
          </ScrollView>
        ))}

      {activeTab === 'matches' &&
        (historyLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <FlatList
            data={matchHistory}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <MatchHistoryRow item={item} />}
            ListHeaderComponent={matchHistory && matchHistory.length > 0 ? MatchHistoryHeader : null}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text className="text-textSecondary text-center mt-8 px-4">No match history available</Text>
            }
          />
        ))}

      {activeTab === 'stats' && (
        <View className="flex-1">
          <View className="flex-row px-4 pb-2 gap-2">
            {STAT_FILTERS.map((f) => {
              const isActive = f.key === statFilter;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setStatFilter(f.key)}
                  className={`flex-1 py-1.5 rounded-lg items-center border ${
                    isActive ? 'bg-primary border-primary' : 'bg-surface border-primary'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${isActive ? 'text-background' : 'text-primary'}`}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {profileLoading ? (
            <ActivityIndicator color={c.primary} className="mt-8" />
          ) : !profile?.statistics || profile.statistics.length === 0 ? (
            <Text className="text-textSecondary text-center mt-8 px-4">No stats available</Text>
          ) : statFilter === 'total' ? (
            <FlatList
              data={[{ key: 'total' }]}
              keyExtractor={(item) => item.key}
              renderItem={() => (
                <CompetitionStatCard
                  headerLeft="Total"
                  headerRight={teamName}
                  entries={profile.statistics ?? []}
                />
              )}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            />
          ) : (
            <FlatList
              data={filteredEntries}
              keyExtractor={(entry, i) => `${entry.league?.id ?? 'unknown'}-${i}`}
              renderItem={({ item: entry }) => (
                <CompetitionStatCard
                  headerLeft={entry.league?.season ? String(entry.league.season) : ''}
                  headerRight={[entry.league?.name, entry.team?.name].filter(Boolean).join(' · ')}
                  entries={[entry]}
                />
              )}
              contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
              ListEmptyComponent={
                <Text className="text-textSecondary text-center mt-8 px-4">
                  No {STAT_FILTERS.find((f) => f.key === statFilter)?.label.toLowerCase()} stats available
                </Text>
              }
            />
          )}
        </View>
      )}
    </View>
  );
}
