import { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, SectionList, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTeamProfile, useTeamTM, useTeamMatches, useTeamSquad, useTeamStatistics } from '../../../../src/hooks/useTeamDetail';
import { useStandings } from '../../../../src/hooks/useLeagueDetail';
import { useCountries } from '../../../../src/hooks/useCountries';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';
import { getFlagUrl } from '../../../../src/lib/flags';
import type { Match, PlayerFullStats } from '../../../../src/api/leagueDetail';
import type { Player } from '../../../../src/api/teamDetail';
import type { Country } from '../../../../src/api/countries';

type Tab = 'fixtures' | 'squad' | 'stats' | 'table';

const TABS: { key: Tab; label: string }[] = [
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'squad', label: 'Squad' },
  { key: 'stats', label: 'Stats' },
  { key: 'table', label: 'Table' },
];

const POSITION_ORDER = ['Goalkeeper', 'Defender', 'Midfielder', 'Attacker'];

type KeyPlayerCategory = 'goals' | 'assists' | 'appearances' | 'passes' | 'key_passes' | 'tackles' | 'interceptions';

const KEY_PLAYER_CATEGORIES: {
  key: KeyPlayerCategory;
  label: string;
  extractor: (entry: PlayerFullStats) => number | null | undefined;
}[] = [
  { key: 'goals', label: 'Goals', extractor: (e) => e.goals?.total },
  { key: 'assists', label: 'Assists', extractor: (e) => e.goals?.assists },
  { key: 'appearances', label: 'Appearances', extractor: (e) => e.games?.appearences },
  { key: 'passes', label: 'Passes', extractor: (e) => e.passes?.total },
  { key: 'key_passes', label: 'Key Passes', extractor: (e) => e.passes?.key },
  { key: 'tackles', label: 'Tackles', extractor: (e) => e.tackles?.total },
  { key: 'interceptions', label: 'Interceptions', extractor: (e) => e.tackles?.interceptions },
];

function sumStatForTeam(
  player: Player,
  teamId: number,
  extractor: (entry: PlayerFullStats) => number | null | undefined
): number {
  if (!player.statistics) return 0;
  return player.statistics
    .filter((entry) => entry.team?.id === teamId)
    .reduce((sum, entry) => sum + (extractor(entry) ?? 0), 0);
}

function sumCardBuckets(buckets?: Record<string, { total: number | null }>): number {
  if (!buckets) return 0;
  return Object.values(buckets).reduce((sum, bucket) => sum + (bucket.total ?? 0), 0);
}

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} \u00b7 ${timePart}`;
}

function TeamCrest({ uri, size = 24 }: { uri: string | null; size?: number }) {
  const c = useThemeColors();
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size }} className="mr-2" resizeMode="contain" />
  ) : (
    <View style={{ width: size, height: size, backgroundColor: c.card }} className="mr-2 rounded-full" />
  );
}

function FormChips({ form }: { form: string | null }) {
  const c = useThemeColors();
  if (!form) return null;
  const letters = form.slice(-5).split('');
  return (
    <View className="flex-row gap-1">
      {letters.map((letter, i) => {
        const chipColor =
          letter === 'W' ? c.primary : letter === 'L' ? '#ef4444' : c.muted;
        return (
          <View key={i} style={{ backgroundColor: chipColor }} className="w-5 h-5 rounded-full items-center justify-center">
            <Text style={{ color: c.bg }} className="text-[10px] font-bold">{letter}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TeamMatchRow({ match, teamId }: { match: Match; teamId: number }) {
  const c = useThemeColors();
  const isFinished = match.status === 'finished';
  const isHome = match.home_team_id === teamId;
  const opponentName = isHome ? match.away_team : match.home_team;
  const opponentLogo = isHome ? match.away_team_logo : match.home_team_logo;
  const teamScore = isHome ? match.home_score : match.away_score;
  const opponentScore = isHome ? match.away_score : match.home_score;

  return (
    <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="flex-row items-center border rounded-lg px-4 py-3 mb-2 mx-4">
      <View className="flex-1">
        <Text style={{ color: c.muted }} className="text-xs mb-1">
          {isHome ? 'vs' : '@'} {opponentName}
        </Text>
        <Text style={{ color: c.muted }} className="text-xs">{formatKickoff(match.kickoff_time)}</Text>
      </View>
      <TeamCrest uri={opponentLogo} size={24} />
      {isFinished ? (
        <Text style={{ color: c.text }} className="text-sm font-bold w-14 text-right">
          {teamScore} - {opponentScore}
        </Text>
      ) : (
        <Text style={{ color: c.muted }} className="text-xs w-14 text-right">{match.status}</Text>
      )}
    </View>
  );
}

function goToPlayer(router: ReturnType<typeof useRouter>, player: { api_football_id: number; name: string; photo: string | null; team_id: number; team_name: string; position?: string | null; number?: number | null }) {
  const href =
    `/(main)/(app)/player/${player.api_football_id}?name=${encodeURIComponent(player.name)}&photo=${encodeURIComponent(
      player.photo ?? ''
    )}&teamId=${player.team_id}&teamName=${encodeURIComponent(player.team_name)}&position=${encodeURIComponent(
      player.position ?? ''
    )}&number=${player.number ?? ''}` as Href;
  router.push(href);
}

function SquadColumnHeader() {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center">
      <Text style={{ color: c.muted }} className="text-[10px] font-semibold w-10 text-right" numberOfLines={1}>
        Apps
      </Text>
      <Text style={{ color: c.muted }} className="text-[10px] font-semibold w-10 text-right" numberOfLines={1}>
        Goals
      </Text>
      <Text style={{ color: c.muted }} className="text-[10px] font-semibold w-10 text-right" numberOfLines={1}>
        Ast
      </Text>
    </View>
  );
}

function PlayerRow({ player, teamId, countries }: { player: Player; teamId: number; countries: Country[] | undefined }) {
  const c = useThemeColors();
  const router = useRouter();
  const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';

  const appearances = sumStatForTeam(player, teamId, (e) => e.games?.appearences);
  const goals = sumStatForTeam(player, teamId, (e) => e.goals?.total);
  const assists = sumStatForTeam(player, teamId, (e) => e.goals?.assists);
  const hasStats = appearances > 0 || goals > 0 || assists > 0;

  const meta = [player.age != null ? `Age ${player.age}` : null, player.number != null ? `No.${player.number}` : null]
    .filter(Boolean)
    .join(' \u00b7 ');
  const flagUrl = getFlagUrl(player.nationality, countries);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => goToPlayer(router, player)}
      style={{ backgroundColor: c.surface, borderColor: c.border }}
      className="flex-row items-center border rounded-lg px-3 py-3 mb-2 mx-4"
    >
      {player.photo ? (
        <Image source={{ uri: player.photo }} className="w-9 h-9 mr-3 rounded-full" resizeMode="cover" />
      ) : (
        <View style={{ backgroundColor: c.card }} className="w-9 h-9 mr-3 rounded-full items-center justify-center">
          <Text style={{ color: c.text }} className="text-xs font-bold">{initial}</Text>
        </View>
      )}
      <View className="flex-1">
        <Text style={{ color: c.text }} className="text-sm font-medium" numberOfLines={1}>
          {player.name}
        </Text>
        <View className="flex-row items-center mt-0.5">
          {meta ? (
            <Text style={{ color: c.muted }} className="text-xs" numberOfLines={1}>
              {meta}
              {player.nationality ? ' \u00b7 ' : ''}
            </Text>
          ) : null}
          {flagUrl && <Image source={{ uri: flagUrl }} className="w-3.5 h-2.5 mr-1 rounded-sm" resizeMode="cover" />}
          {player.nationality ? (
            <Text style={{ color: c.muted }} className="text-xs" numberOfLines={1}>
              {player.nationality}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={{ color: c.text }} className="text-xs w-10 text-right" numberOfLines={1}>
        {hasStats ? appearances : '~'}
      </Text>
      <Text style={{ color: c.text }} className="text-xs w-10 text-right" numberOfLines={1}>
        {hasStats ? goals : '~'}
      </Text>
      <Text style={{ color: c.text }} className="text-xs w-10 text-right" numberOfLines={1}>
        {hasStats ? assists : '~'}
      </Text>
    </TouchableOpacity>
  );
}

function formatEur(n: number | null | undefined): string {
  if (n == null) return '-';
  if (n >= 1e9) return `€${(n / 1e9).toFixed(2)}bn`;
  if (n >= 1e6) return `€${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `€${Math.round(n / 1e3)}K`;
  return `€${n}`;
}

function StatSectionHeader({ title }: { title: string }) {
  const c = useThemeColors();
  return <Text style={{ color: c.text }} className="text-sm font-bold px-4 pt-2 pb-2">{title}</Text>;
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  const c = useThemeColors();
  return (
    <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="flex-1 border rounded-lg px-3 py-3 items-center">
      <Text style={{ color: c.muted }} className="text-xs mb-1 text-center" numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: c.text }} className="text-lg font-bold">{value}</Text>
    </View>
  );
}

function StatTileGrid({ tiles }: { tiles: { label: string; value: number | string }[] }) {
  const rows: { label: string; value: number | string }[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));

  return (
    <View className="px-4 gap-2 mb-2">
      {rows.map((row, i) => (
        <View key={i} className="flex-row gap-2">
          {row.map((tile) => (
            <StatTile key={tile.label} label={tile.label} value={tile.value} />
          ))}
          {row.length === 1 && <View className="flex-1" />}
        </View>
      ))}
    </View>
  );
}

function KeyPlayerTile({
  category,
  player,
  value,
}: {
  category: string;
  player: Player;
  value: number;
}) {
  const c = useThemeColors();
  const router = useRouter();
  const initial = player.name ? player.name.charAt(0).toUpperCase() : '?';
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => goToPlayer(router, player)}
      style={{ backgroundColor: c.surface, borderColor: c.border }}
      className="flex-1 items-center border rounded-lg px-2 py-3"
    >
      <Text style={{ color: c.muted }} className="text-[10px] mb-2 uppercase" numberOfLines={1}>
        {category}
      </Text>
      {player.photo ? (
        <Image source={{ uri: player.photo }} className="w-12 h-12 rounded-full mb-2" resizeMode="cover" />
      ) : (
        <View style={{ backgroundColor: c.card }} className="w-12 h-12 rounded-full mb-2 items-center justify-center">
          <Text style={{ color: c.text }} className="text-sm font-bold">{initial}</Text>
        </View>
      )}
      <Text style={{ color: c.text }} className="text-xs font-medium text-center" numberOfLines={1}>
        {player.name}
      </Text>
      <Text style={{ color: c.primary }} className="text-sm font-bold mt-0.5">{value}</Text>
    </TouchableOpacity>
  );
}

export default function TeamDetailScreen() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{
    id: string;
    leagueId?: string;
    season?: string;
    name?: string;
    logo?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const teamId = Number(params.id);
  const leagueId = params.leagueId ? Number(params.leagueId) : undefined;
  const season = params.season ? Number(params.season) : undefined;
  const fallbackName = params.name || 'Team';
  const fallbackLogo = params.logo || null;

  const [activeTab, setActiveTab] = useState<Tab>('fixtures');

  const { data: profile, isLoading: profileLoading } = useTeamProfile(teamId);
  const { data: teamTM } = useTeamTM(teamId);
  const { data: matches, isLoading: matchesLoading } = useTeamMatches(teamId);
  const { data: squad, isLoading: squadLoading } = useTeamSquad(teamId);
  const { data: countries } = useCountries();
  const { data: standings, isLoading: standingsLoading } = useStandings(leagueId ?? 0, season ?? 0);
  const { data: teamStats, isLoading: teamStatsLoading } = useTeamStatistics(
    leagueId ?? 0,
    teamId,
    season ?? 0
  );

  const teamName = profile?.team.name || fallbackName;
  const teamLogo = profile?.team.logo || fallbackLogo;

  const teamStanding = useMemo(
    () => (standings ?? []).find((s) => s.team_id === teamId),
    [standings, teamId]
  );

  const sortedMatches = useMemo(() => {
    return [...(matches ?? [])].sort(
      (a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()
    );
  }, [matches]);

  const squadSections = useMemo(() => {
    const buckets = new Map<string, Player[]>();
    (squad ?? []).forEach((p) => {
      const key = p.position && POSITION_ORDER.includes(p.position) ? p.position : 'Other';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(p);
    });
    const order = [...POSITION_ORDER, 'Other'];
    return order
      .filter((pos) => buckets.has(pos))
      .map((pos) => ({ title: pos, data: buckets.get(pos)! }));
  }, [squad]);

  const d = teamStats?.data;

  const disciplineTiles = teamStats
    ? [
        { label: 'Yellow Cards', value: sumCardBuckets(d?.cards?.yellow) },
        { label: 'Red Cards', value: sumCardBuckets(d?.cards?.red) },
      ]
    : [];

  const scoringTiles = teamStats
    ? [
        { label: 'Goals For', value: d?.goals?.for?.total?.total ?? 0 },
        { label: 'Goals Against', value: d?.goals?.against?.total?.total ?? 0 },
        { label: 'Clean Sheets', value: d?.clean_sheet?.total ?? 0 },
        { label: 'Failed to Score', value: d?.failed_to_score?.total ?? 0 },
        { label: 'Penalties Scored', value: d?.penalty?.scored?.total ?? 0 },
      ]
    : [];

  const biggestTiles = d?.biggest
    ? [
        { label: 'Biggest Win (Home)', value: d.biggest.wins?.home ?? '-' },
        { label: 'Biggest Win (Away)', value: d.biggest.wins?.away ?? '-' },
        { label: 'Biggest Loss (Home)', value: d.biggest.loses?.home ?? '-' },
        { label: 'Biggest Loss (Away)', value: d.biggest.loses?.away ?? '-' },
      ]
    : [];

  const standingsWindow = useMemo(() => {
    if (!standings || !teamStanding) return [];
    const sorted = [...standings].sort((a, b) => a.rank - b.rank);
    const idx = sorted.findIndex((s) => s.team_id === teamId);
    if (idx === -1) return sorted.slice(0, 3);
    const start = Math.max(0, idx - 2);
    const end = Math.min(sorted.length, idx + 3);
    return sorted.slice(start, end);
  }, [standings, teamStanding, teamId]);

  const keyPlayers = useMemo(() => {
    if (!squad) return [];
    return KEY_PLAYER_CATEGORIES.map((cat) => {
      let best: { player: Player; value: number } | null = null;
      for (const player of squad) {
        const value = sumStatForTeam(player, teamId, cat.extractor);
        if (value > 0 && (!best || value > best.value)) {
          best = { player, value };
        }
      }
      return best ? { category: cat.label, player: best.player, value: best.value } : null;
    }).filter((row): row is { category: string; player: Player; value: number } => row !== null);
  }, [squad, teamId]);

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <View
        style={{ paddingTop: insets.top + 8, borderColor: c.border }}
        className="flex-row items-center px-4 pb-3 border-b"
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3" hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={{ color: c.text }} className="text-lg font-bold flex-1" numberOfLines={1}>
          {teamName}
        </Text>
      </View>

      <View style={{ borderColor: c.border }} className="flex-row items-center px-4 py-4 border-b">
        <TeamCrest uri={teamLogo} size={56} />
        <View className="flex-1 ml-2">
          <Text style={{ color: c.text }} className="text-lg font-bold" numberOfLines={1}>
            {teamName}
          </Text>
          {profileLoading ? (
            <ActivityIndicator color={c.primary} size="small" className="mt-1 self-start" />
          ) : (
            <>
              {profile?.team.founded && (
                <Text style={{ color: c.muted }} className="text-xs mt-0.5">Founded {profile.team.founded}</Text>
              )}
              {profile?.venue?.name && (
                <Text style={{ color: c.muted }} className="text-xs" numberOfLines={1}>
                  {profile.venue.name}
                  {profile.venue.city ? `, ${profile.venue.city}` : ''}
                </Text>
              )}
            </>
          )}
          {teamStanding && (
            <View className="flex-row items-center mt-1 gap-2">
              <Text style={{ color: c.primary }} className="text-xs font-semibold">#{teamStanding.rank} in league</Text>
              <FormChips form={teamStanding.form} />
            </View>
          )}
          {teamTM?.squad_value_eur != null && (
            <Text className="text-textSecondary text-xs mt-0.5">
              Squad value <Text className="text-text font-semibold">{formatEur(teamTM.squad_value_eur)}</Text>
              <Text className="text-textMuted"> · Transfermarkt</Text>
            </Text>
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
              style={{
                backgroundColor: isActive ? c.primary : c.surface,
                borderColor: isActive ? c.primary : c.border,
              }}
              className="flex-1 py-2 rounded-lg items-center border"
            >
              <Text
                style={{ color: isActive ? c.bg : c.muted }}
                className="text-xs font-semibold"
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'fixtures' &&
        (matchesLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <FlatList
            data={sortedMatches}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <TeamMatchRow match={item} teamId={teamId} />}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">No matches found</Text>
            }
          />
        ))}

      {activeTab === 'squad' &&
        (squadLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <SectionList
            sections={squadSections}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <PlayerRow player={item} teamId={teamId} countries={countries} />}
            renderSectionHeader={({ section }) => (
              <View style={{ backgroundColor: c.bg }} className="mx-4 px-3 pt-2 pb-1">
                <View className="flex-row items-center justify-between">
                  <Text style={{ color: c.muted }} className="text-xs font-semibold uppercase flex-1" numberOfLines={1}>
                    {section.title}
                  </Text>
                  <SquadColumnHeader />
                </View>
              </View>
            )}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">No squad data available</Text>
            }
          />
        ))}

      {activeTab === 'stats' &&
        (teamStatsLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : teamStats ? (
          <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
            <StatSectionHeader title="Discipline" />
            <StatTileGrid tiles={disciplineTiles} />

            <StatSectionHeader title="Scoring" />
            <StatTileGrid tiles={scoringTiles} />

            {biggestTiles.length > 0 && (
              <>
                <StatSectionHeader title="Biggest Results" />
                <StatTileGrid tiles={biggestTiles} />
              </>
            )}

            {standingsWindow.length > 0 && (
              <>
                <StatSectionHeader title="Position in League Table" />
                <View className="px-4 gap-2 mb-2">
                  {standingsWindow.map((s) => {
                    const isCurrentTeam = s.team_id === teamId;
                    return (
                      <View
                        key={s.id}
                        style={{
                          backgroundColor: c.surface,
                          borderColor: isCurrentTeam ? c.primary : c.border,
                        }}
                        className="flex-row items-center border rounded-lg px-3 py-2.5"
                      >
                        <Text style={{ color: c.muted }} className="text-xs w-5 text-center">{s.rank}</Text>
                        <TeamCrest uri={s.team_logo} size={20} />
                        <Text
                          style={{ color: isCurrentTeam ? c.primary : c.text }}
                          className={`text-sm flex-1 ${isCurrentTeam ? 'font-semibold' : ''}`}
                          numberOfLines={1}
                        >
                          {s.team_name}
                        </Text>
                        <Text style={{ color: c.muted }} className="text-xs w-6 text-center">{s.played}</Text>
                        <Text style={{ color: c.text }} className="text-sm font-bold w-8 text-center">{s.points}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {keyPlayers.length > 0 && (
              <>
                <StatSectionHeader title="Key Player" />
                <View className="px-4 gap-2 mb-2">
                  {Array.from({ length: Math.ceil(keyPlayers.length / 2) }).map((_, rowIndex) => {
                    const row = keyPlayers.slice(rowIndex * 2, rowIndex * 2 + 2);
                    return (
                      <View key={rowIndex} className="flex-row gap-2">
                        {row.map((kp) => (
                          <KeyPlayerTile
                            key={kp.category}
                            category={kp.category}
                            player={kp.player}
                            value={kp.value}
                          />
                        ))}
                        {row.length === 1 && <View className="flex-1" />}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        ) : (
          <Text style={{ color: c.muted }} className="text-center mt-8 px-4">No stats available</Text>
        ))}

      {activeTab === 'table' &&
        (standingsLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <FlatList
            data={standings}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => {
              const isCurrentTeam = item.team_id === teamId;
              return (
                <View
                  style={{
                    backgroundColor: c.surface,
                    borderColor: isCurrentTeam ? c.primary : c.border,
                  }}
                  className="flex-row items-center border rounded-lg px-3 py-2.5 mb-2 mx-4"
                >
                  <Text style={{ color: c.muted }} className="text-xs w-5 text-center">{item.rank}</Text>
                  <TeamCrest uri={item.team_logo} size={20} />
                  <Text
                    style={{ color: isCurrentTeam ? c.primary : c.text }}
                    className={`text-sm flex-1 ${isCurrentTeam ? 'font-semibold' : ''}`}
                    numberOfLines={1}
                  >
                    {item.team_name}
                  </Text>
                  <Text style={{ color: c.muted }} className="text-xs w-6 text-center">{item.played}</Text>
                  <Text style={{ color: c.text }} className="text-sm font-bold w-8 text-center">{item.points}</Text>
                </View>
              );
            }}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">No table data available</Text>
            }
          />
        ))}
    </View>
  );
}
