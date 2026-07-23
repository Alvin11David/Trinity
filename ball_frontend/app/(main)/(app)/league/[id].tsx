import { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';
import { useStandings, useLeagueMatches, usePlayerStats, useTeamStatsLeaderboard } from '../../../../src/hooks/useLeagueDetail';
import type { Standing, Match, PlayerLeagueStat, TeamStatistics } from '../../../../src/api/leagueDetail';

type Tab = 'table' | 'fixtures' | 'results' | 'stats' | 'team-stats';

const TABS: { key: Tab; label: string }[] = [
  { key: 'table', label: 'Table' },
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'results', label: 'Results' },
  { key: 'stats', label: 'Player Stats' },
  { key: 'team-stats', label: 'Team Stats' },
];

type StatCategory =
  | 'goals' | 'assists' | 'yellow_cards' | 'red_cards' | 'penalties_scored'
  | 'shots' | 'shots_on_target' | 'dribbles_attempted' | 'dribbles_successful'
  | 'fouled' | 'key_passes' | 'passes';

const STAT_CATEGORIES: { key: StatCategory; label: string }[] = [
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'yellow_cards', label: 'Yellow cards' },
  { key: 'red_cards', label: 'Red cards' },
  { key: 'penalties_scored', label: 'Penalty scored' },
  { key: 'shots', label: 'Shots' },
  { key: 'shots_on_target', label: 'Shots On Target' },
  { key: 'dribbles_attempted', label: 'Dribbles attempted' },
  { key: 'dribbles_successful', label: 'Successful dribbles' },
  { key: 'fouled', label: 'Fouled' },
  { key: 'key_passes', label: 'Key passes' },
  { key: 'passes', label: 'Passes' },
];

function getStatValue(player: PlayerLeagueStat, category: StatCategory): number {
  if (category === 'goals') return player.goals;
  if (category === 'assists') return player.assists;
  const fs = player.full_stats;
  if (!fs) return 0;
  switch (category) {
    case 'yellow_cards': return fs.cards?.yellow ?? 0;
    case 'red_cards': return fs.cards?.red ?? 0;
    case 'penalties_scored': return fs.penalty?.scored ?? 0;
    case 'shots': return fs.shots?.total ?? 0;
    case 'shots_on_target': return fs.shots?.on ?? 0;
    case 'dribbles_attempted': return fs.dribbles?.attempts ?? 0;
    case 'dribbles_successful': return fs.dribbles?.success ?? 0;
    case 'fouled': return fs.fouls?.drawn ?? 0;
    case 'key_passes': return fs.passes?.key ?? 0;
    case 'passes': return fs.passes?.total ?? 0;
    default: return 0;
  }
}

type TeamStatCategory = 'goals_for' | 'goals_against' | 'clean_sheets' | 'failed_to_score' | 'penalties_scored' | 'yellow_cards' | 'red_cards';

const TEAM_STAT_CATEGORIES: { key: TeamStatCategory; label: string }[] = [
  { key: 'goals_for', label: 'Goals' },
  { key: 'goals_against', label: 'Goals Against' },
  { key: 'clean_sheets', label: 'Clean Sheets' },
  { key: 'failed_to_score', label: 'Failed to Score' },
  { key: 'penalties_scored', label: 'Penalties Scored' },
  { key: 'yellow_cards', label: 'Yellow Cards' },
  { key: 'red_cards', label: 'Red Cards' },
];

function sumCardBuckets(buckets?: Record<string, { total: number | null }>): number {
  if (!buckets) return 0;
  return Object.values(buckets).reduce((sum, bucket) => sum + (bucket.total ?? 0), 0);
}

function getTeamStatValue(team: TeamStatistics, category: TeamStatCategory): number {
  const d = team.data;
  switch (category) {
    case 'goals_for': return d.goals?.for?.total?.total ?? 0;
    case 'goals_against': return d.goals?.against?.total?.total ?? 0;
    case 'clean_sheets': return d.clean_sheet?.total ?? 0;
    case 'failed_to_score': return d.failed_to_score?.total ?? 0;
    case 'penalties_scored': return d.penalty?.scored?.total ?? 0;
    case 'yellow_cards': return sumCardBuckets(d.cards?.yellow);
    case 'red_cards': return sumCardBuckets(d.cards?.red);
    default: return 0;
  }
}

function getAccentClass(description: string | null) {
  if (!description) return 'border-l-textMuted';
  const normalized = description.toLowerCase();
  if (normalized.includes('champions league') || normalized.includes('europa')) return 'border-l-primary';
  if (normalized.includes('relegation')) return 'border-l-redCard';
  return 'border-l-textMuted';
}

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function TeamLogo({ uri, size = 24 }: { uri: string | null; size?: number }) {
  return uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      className="mr-2"
      resizeMode="contain"
    />
  ) : (
    <View
      style={{ width: size, height: size }}
      className="mr-2 bg-elevated rounded-full"
    />
  );
}

function StandingsHeader() {
  return (
    <View className="flex-row items-center bg-elevated border border-border rounded-lg px-3 py-2 mb-2 mx-4">
      <Text className="text-textSecondary text-[10px] font-semibold w-5 text-center">#</Text>
      <View style={{ width: 20 }} className="mr-2" />
      <Text className="text-textSecondary text-[10px] font-semibold flex-1">Team</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-6 text-center">P</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-6 text-center">W</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-6 text-center">D</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-6 text-center">L</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-12 text-center">F/A</Text>
      <Text className="text-textSecondary text-[10px] font-semibold w-8 text-center">Pts</Text>
    </View>
  );
}

function StandingRow({ standing, leagueId, season }: { standing: Standing; leagueId: number; season: number }) {
  const router = useRouter();

  const handlePress = () => {
    // team/[id] isn't in the generated typed-routes union until the dev
    // server regenerates it, so the computed href needs a manual Href cast.
    const href =
      `/(main)/(app)/team/${standing.team_id}?leagueId=${leagueId}&season=${season}&name=${encodeURIComponent(
        standing.team_name
      )}&logo=${encodeURIComponent(standing.team_logo ?? '')}` as Href;
    router.push(href);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      className={`flex-row items-center bg-surface border border-border ${getAccentClass(standing.description)} border-l-4 rounded-lg px-3 py-2.5 mb-2 mx-4`}
    >
      <Text className="text-textSecondary text-xs w-5 text-center">{standing.rank}</Text>
      <TeamLogo uri={standing.team_logo} size={20} />
      <Text className="text-text text-sm flex-1" numberOfLines={1}>
        {standing.team_name}
      </Text>
      <Text className="text-textSecondary text-xs w-6 text-center">{standing.played}</Text>
      <Text className="text-textSecondary text-xs w-6 text-center">{standing.win}</Text>
      <Text className="text-textSecondary text-xs w-6 text-center">{standing.draw}</Text>
      <Text className="text-textSecondary text-xs w-6 text-center">{standing.lose}</Text>
      <Text className="text-textSecondary text-xs w-12 text-center">
        {standing.goals_for}/{standing.goals_against}
      </Text>
      <Text className="text-text text-sm font-bold w-8 text-center">{standing.points}</Text>
    </TouchableOpacity>
  );
}

function MatchRow({
  match,
  variant,
  leagueId,
  season,
}: {
  match: Match;
  variant: 'fixture' | 'result';
  leagueId: number;
  season: number;
}) {
  const router = useRouter();

  const goToTeam = (teamId: number | null, teamName: string, teamLogo: string | null) => {
    if (!teamId) return;
    // team/[id] isn't in the generated typed-routes union until the dev
    // server regenerates it, so the computed href needs a manual Href cast.
    const href =
      `/(main)/(app)/team/${teamId}?leagueId=${leagueId}&season=${season}&name=${encodeURIComponent(
        teamName
      )}&logo=${encodeURIComponent(teamLogo ?? '')}` as Href;
    router.push(href);
  };

  return (
    <View className="bg-surface border border-border rounded-lg px-4 py-3 mb-2 mx-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-textSecondary text-xs">
          {variant === 'fixture' ? formatKickoff(match.kickoff_time) : formatKickoff(match.kickoff_time)}
        </Text>
        {match.venue_name && (
          <Text className="text-textMuted text-xs" numberOfLines={1}>
            {match.venue_name}
          </Text>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => goToTeam(match.home_team_id, match.home_team, match.home_team_logo)}
        className="flex-row items-center mb-1"
      >
        <TeamLogo uri={match.home_team_logo} size={20} />
        <Text className="text-text text-sm flex-1" numberOfLines={1}>
          {match.home_team}
        </Text>
        {variant === 'result' && (
          <Text className="text-text text-sm font-bold w-6 text-center">{match.home_score}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => goToTeam(match.away_team_id, match.away_team, match.away_team_logo)}
        className="flex-row items-center"
      >
        <TeamLogo uri={match.away_team_logo} size={20} />
        <Text className="text-text text-sm flex-1" numberOfLines={1}>
          {match.away_team}
        </Text>
        {variant === 'result' && (
          <Text className="text-text text-sm font-bold w-6 text-center">{match.away_score}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function PlayerStatRow({ stat, rank, value }: { stat: PlayerLeagueStat; rank: number; value: number }) {
  const router = useRouter();
  const initial = stat.player_name ? stat.player_name.charAt(0).toUpperCase() : '?';

  const handlePress = () => {
    // player/[id] isn't in the generated typed-routes union until the dev
    // server regenerates it, so the computed href needs a manual Href cast.
    const href =
      `/(main)/(app)/player/${stat.player_id}?name=${encodeURIComponent(stat.player_name)}&photo=${encodeURIComponent(
        stat.player_photo ?? ''
      )}&teamId=${stat.team_id}&teamName=${encodeURIComponent(stat.team_name)}` as Href;
    router.push(href);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-3 mb-2"
    >
      <Text className="text-textSecondary text-xs w-5 text-center">{rank}</Text>
      {stat.player_photo ? (
        <Image source={{ uri: stat.player_photo }} className="w-9 h-9 mr-3 rounded-full" resizeMode="cover" />
      ) : (
        <View className="w-9 h-9 mr-3 bg-elevated rounded-full items-center justify-center">
          <Text className="text-text text-xs font-bold">{initial}</Text>
        </View>
      )}
      <View className="flex-1">
        <Text className="text-text text-sm font-medium" numberOfLines={1}>
          {stat.player_name}
        </Text>
        <Text className="text-textSecondary text-xs" numberOfLines={1}>
          {stat.team_name}
        </Text>
      </View>
      <Text className="text-primary text-base font-bold w-8 text-center">{value}</Text>
    </TouchableOpacity>
  );
}

function TeamStatRow({ team, rank, value }: { team: TeamStatistics; rank: number; value: number }) {
  return (
    <View className="flex-row items-center bg-surface border border-border rounded-lg px-3 py-3 mb-2">
      <Text className="text-textSecondary text-xs w-5 text-center">{rank}</Text>
      <TeamLogo uri={team.team_logo} size={28} />
      <Text className="text-text text-sm font-medium flex-1" numberOfLines={1}>
        {team.team_name}
      </Text>
      <Text className="text-primary text-base font-bold w-10 text-center">{value}</Text>
    </View>
  );
}

export default function LeagueDetailScreen() {
  const params = useLocalSearchParams<{ id: string; season?: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  const leagueId = Number(params.id);
  const season = Number(params.season);
  const leagueName = params.name || 'League';

  // TEMPORARY: 2026/27 season has no player/team stats data yet (season hasn't started).
  // Using 2025 (last completed season) for testing/dev purposes until real 2026 data exists.
  // Remove this override once the season begins and sync tasks populate 2026 data.
  const statsSeasonOverride = 2025;

  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [statCategory, setStatCategory] = useState<StatCategory>('goals');
  const [teamStatCategory, setTeamStatCategory] = useState<TeamStatCategory>('goals_for');

  const { data: standings, isLoading: standingsLoading } = useStandings(leagueId, statsSeasonOverride);
  const { data: matches, isLoading: matchesLoading } = useLeagueMatches(leagueId);
  const { data: scorers, isLoading: scorersLoading } = usePlayerStats(leagueId, statsSeasonOverride, 'scorer');
  const { data: assisters, isLoading: assistersLoading } = usePlayerStats(leagueId, statsSeasonOverride, 'assist');
  const { data: teamStats, isLoading: teamStatsLoading } = useTeamStatsLeaderboard(leagueId, statsSeasonOverride);
  const statsLoading = scorersLoading || assistersLoading;

  const fixtures = useMemo(() => {
    return (matches ?? [])
      .filter((m) => m.status === 'scheduled')
      .sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime());
  }, [matches]);

  const results = useMemo(() => {
    return (matches ?? [])
      .filter((m) => m.status === 'finished')
      .sort((a, b) => new Date(b.kickoff_time).getTime() - new Date(a.kickoff_time).getTime());
  }, [matches]);

  // The scorer/assist endpoints are the only player pools we currently have;
  // every non-goals/assists category is ranked client-side over their union.
  const combinedPlayerPool = useMemo(() => {
    const byPlayerId = new Map<number, PlayerLeagueStat>();
    (scorers ?? []).forEach((p) => byPlayerId.set(p.player_id, p));
    (assisters ?? []).forEach((p) => {
      if (!byPlayerId.has(p.player_id)) byPlayerId.set(p.player_id, p);
    });
    return Array.from(byPlayerId.values());
  }, [scorers, assisters]);

  const rankedPlayers = useMemo(() => {
    if (statCategory === 'goals') {
      return [...(scorers ?? [])].sort((a, b) => a.rank_position - b.rank_position);
    }
    if (statCategory === 'assists') {
      return [...(assisters ?? [])].sort((a, b) => a.rank_position - b.rank_position);
    }
    return [...combinedPlayerPool].sort(
      (a, b) => getStatValue(b, statCategory) - getStatValue(a, statCategory)
    );
  }, [statCategory, scorers, assisters, combinedPlayerPool]);

  const rankedTeams = useMemo(() => {
    return [...(teamStats ?? [])].sort(
      (a, b) => getTeamStatValue(b, teamStatCategory) - getTeamStatValue(a, teamStatCategory)
    );
  }, [teamStats, teamStatCategory]);

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
          {leagueName}
        </Text>
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

      {activeTab === 'table' &&
        (standingsLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <FlatList
            data={standings}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <StandingRow standing={item} leagueId={leagueId} season={statsSeasonOverride} />
            )}
            ListHeaderComponent={standings && standings.length > 0 ? StandingsHeader : null}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text className="text-textSecondary text-center mt-8 px-4">No standings available</Text>
            }
          />
        ))}

      {activeTab === 'fixtures' &&
        (matchesLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <FlatList
            data={fixtures}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <MatchRow match={item} variant="fixture" leagueId={leagueId} season={statsSeasonOverride} />
            )}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text className="text-textSecondary text-center mt-8 px-4">No upcoming fixtures</Text>
            }
          />
        ))}

      {activeTab === 'results' &&
        (matchesLoading ? (
          <ActivityIndicator color={c.primary} className="mt-8" />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <MatchRow match={item} variant="result" leagueId={leagueId} season={statsSeasonOverride} />
            )}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}
            ListEmptyComponent={
              <Text className="text-textSecondary text-center mt-8 px-4">No results yet</Text>
            }
          />
        ))}

      {activeTab === 'stats' && (
        <View className="flex-1 flex-row">
          <View className="w-28 border-r border-border">
            <FlatList
              data={STAT_CATEGORIES}
              keyExtractor={(c) => c.key}
              renderItem={({ item }) => {
                const isActive = item.key === statCategory;
                return (
                  <TouchableOpacity
                    onPress={() => setStatCategory(item.key)}
                    className={`px-3 py-3 ${isActive ? 'bg-primary' : 'bg-background'}`}
                  >
                    <Text
                      className={`text-xs ${isActive ? 'text-background font-semibold' : 'text-textSecondary font-medium'}`}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </View>

          <View className="flex-1">
            {statsLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : (
              <FlatList
                data={rankedPlayers}
                keyExtractor={(item) => item.player_id.toString()}
                renderItem={({ item, index }) => (
                  <PlayerStatRow stat={item} rank={index + 1} value={getStatValue(item, statCategory)} />
                )}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: 24, paddingHorizontal: 8 }}
                ListEmptyComponent={
                  <Text className="text-textSecondary text-center mt-8 px-4">No player stats available</Text>
                }
              />
            )}
          </View>
        </View>
      )}

      {activeTab === 'team-stats' && (
        <View className="flex-1 flex-row">
          <View className="w-28 border-r border-border">
            <FlatList
              data={TEAM_STAT_CATEGORIES}
              keyExtractor={(c) => c.key}
              renderItem={({ item }) => {
                const isActive = item.key === teamStatCategory;
                return (
                  <TouchableOpacity
                    onPress={() => setTeamStatCategory(item.key)}
                    className={`px-3 py-3 ${isActive ? 'bg-primary' : 'bg-background'}`}
                  >
                    <Text
                      className={`text-xs ${isActive ? 'text-background font-semibold' : 'text-textSecondary font-medium'}`}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </View>

          <View className="flex-1">
            {teamStatsLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : (
              <FlatList
                data={rankedTeams}
                keyExtractor={(item) => item.team_id.toString()}
                renderItem={({ item, index }) => (
                  <TeamStatRow team={item} rank={index + 1} value={getTeamStatValue(item, teamStatCategory)} />
                )}
                contentContainerStyle={{ paddingTop: 4, paddingBottom: 24, paddingHorizontal: 8 }}
                ListEmptyComponent={
                  <Text className="text-textSecondary text-center mt-8 px-4">No team stats available</Text>
                }
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}
