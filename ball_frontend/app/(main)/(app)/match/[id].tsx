import { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useMatch,
  useMatchOdds,
  useMatchLineup,
  useMatchH2H,
  useMatchPreview,
  useMatchStatistics,
  useMatchPlayerStats,
} from '../../../../src/hooks/useMatchDetail';
import { useTeamSquad } from '../../../../src/hooks/useTeamDetail';
import type {
  OddsBet,
  TeamLineup,
  LineupPlayerEntry,
  TeamFormEntry,
  MatchStatistic,
  MatchPlayerStat,
} from '../../../../src/api/matchDetail';
import type { Match, MatchEventItem } from '../../../../src/api/leagueDetail';
import { getTeamColor } from '../../../../src/lib/teamColors';
import { LiveMatchPanel } from '../../../../src/components/match/LiveMatchPanel';
import { getMatchRoom, extractApiError } from '../../../../src/api/chat';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type Tab = 'facts' | 'stats' | 'lineup' | 'h2h' | 'preview' | 'odds';

// Pre-match: betting hasn't happened yet (Odds) and there's no live data to
// show (Facts/Stats), so the framing is forward-looking (Preview). Once a
// match goes live or finishes, Odds/Preview are swapped for the tabs that
// actually have data (Facts/Stats) — Lineup and H2H stay relevant throughout.
const PRE_MATCH_TABS: { key: Tab; label: string }[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'lineup', label: 'Lineup' },
  { key: 'h2h', label: 'H2H' },
  { key: 'odds', label: 'Odds' },
];

const POST_MATCH_TABS: { key: Tab; label: string }[] = [
  { key: 'facts', label: 'Facts' },
  { key: 'stats', label: 'Stats' },
  { key: 'lineup', label: 'Lineup' },
  { key: 'h2h', label: 'H2H' },
];

// FotMob's primary markets — API-Football bet IDs (unverified against real
// data, see matches/tasks.py::sync_odds_for_match's 7-day window caveat).
const PRIMARY_MARKET_IDS = [1, 8, 5];

const EVENT_ICONS: Record<string, string> = {
  goal: '⚽',
  yellow_card: '🟨',
  red_card: '🟥',
  var: '📺',
  other: '•',
};

// POTM_COLOR was replaced with c.blue500 from useThemeColors()

// API-Football's statistics `type` strings, verified against a real synced
// match (id=2, Liverpool vs Bournemouth) rather than guessed. Ball Possession
// is handled separately below as a percentage bar.
const STAT_GROUPS: { section: string; rows: { label: string; type: string }[] }[] = [
  {
    section: 'Shots',
    rows: [
      { label: 'Total Shots', type: 'Total Shots' },
      { label: 'On Target', type: 'Shots on Goal' },
      { label: 'Off Target', type: 'Shots off Goal' },
      { label: 'Blocked', type: 'Blocked Shots' },
      { label: 'Inside Box', type: 'Shots insidebox' },
      { label: 'Outside Box', type: 'Shots outsidebox' },
    ],
  },
  {
    section: 'General',
    rows: [
      { label: 'Fouls', type: 'Fouls' },
      { label: 'Corners', type: 'Corner Kicks' },
      { label: 'Offsides', type: 'Offsides' },
      { label: 'Yellow Cards', type: 'Yellow Cards' },
      { label: 'Red Cards', type: 'Red Cards' },
    ],
  },
  {
    section: 'Passes',
    rows: [
      { label: 'Total Passes', type: 'Total passes' },
      { label: 'Accurate Passes', type: 'Passes accurate' },
      { label: 'Pass Accuracy', type: 'Passes %' },
    ],
  },
  {
    section: 'Advanced',
    rows: [
      { label: 'Expected Goals (xG)', type: 'expected_goals' },
      { label: 'Goals Prevented', type: 'goals_prevented' },
    ],
  },
];

function ratingColor(ratingNum: number, colors: { primary: string; yellow500: string; red500: string }): string {
  if (ratingNum >= 7) return colors.primary;
  if (ratingNum >= 6) return colors.yellow500;
  return colors.red500;
}

function TeamLogo({ uri, size = 40 }: { uri: string | null; size?: number }) {
  const c = useThemeColors();
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />
  ) : (
    <View style={{ width: size, height: size, backgroundColor: c.card }} className="rounded-full" />
  );
}

function formatKickoff(iso: string) {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function FormChip({ result }: { result: 'W' | 'D' | 'L' | null }) {
  const c = useThemeColors();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: result === 'W' ? c.primary : result === 'D' ? c.muted : result === 'L' ? '#ef4444' : c.muted,
      }}
      className="items-center justify-center mr-1.5"
    >
      <Text className="text-white text-[10px] font-bold">{result ?? '-'}</Text>
    </View>
  );
}

function OddsCard({ bet }: { bet: OddsBet }) {
  const c = useThemeColors();
  return (
    <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="border rounded-lg px-4 py-3 mb-3 mx-4">
      <Text style={{ color: c.text }} className="text-sm font-semibold mb-3">{bet.name}</Text>
      <View className="flex-row flex-wrap gap-2">
        {bet.values.map((v, i) => (
          <View key={`${v.value}-${i}`} style={{ backgroundColor: c.card, borderColor: c.border }} className="border rounded-lg px-3 py-2 items-center min-w-[80px]">
            <Text style={{ color: c.muted }} className="text-xs mb-1" numberOfLines={1}>
              {v.value}
            </Text>
            <Text style={{ color: c.primary }} className="text-sm font-bold">{v.odd}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Highest row = most advanced (attacking) per API-Football's grid convention
// (row 1 is always the goalkeeper). `order: 'toHalfway'` renders GK first,
// attackers last (for the team whose own goal is at the top of a shared
// pitch); `order: 'fromHalfway'` is the mirror, for the team below the
// halfway line.
function groupByGridRow(entries: LineupPlayerEntry[], order: 'toHalfway' | 'fromHalfway') {
  const rows = new Map<number, LineupPlayerEntry[]>();
  entries.forEach((entry) => {
    const grid = entry.player.grid;
    if (!grid) return;
    const row = Number(grid.split(':')[0]);
    if (!rows.has(row)) rows.set(row, []);
    rows.get(row)!.push(entry);
  });
  return Array.from(rows.entries())
    .sort(([a], [b]) => (order === 'toHalfway' ? a - b : b - a))
    .map(([row, players]) => ({
      row,
      players: [...players].sort(
        (a, b) => Number(a.player.grid?.split(':')[1] ?? 0) - Number(b.player.grid?.split(':')[1] ?? 0)
      ),
    }));
}

type PlayerEnrichment = { photo: string | null; rating: string | null; subOffMinute: number | null };

function PlayerChip({
  name,
  number,
  isPOTM,
  enrichment,
}: {
  name: string;
  number: number;
  isPOTM: boolean;
  enrichment: PlayerEnrichment;
}) {
  const c = useThemeColors();
  const { photo, rating, subOffMinute } = enrichment;
  const ratingNum = rating ? parseFloat(rating) : null;
  const badgeColor = isPOTM ? c.blue500 : ratingNum != null ? ratingColor(ratingNum, c) : null;
  const lastName = name.trim().split(' ').slice(-1)[0] || name;

  return (
    <View className="items-center" style={{ width: 60 }}>
      {subOffMinute != null && <Text style={{ color: c.muted }} className="text-[9px] mb-0.5">{subOffMinute}'</Text>}
      <View style={{ width: 40, height: 40 }}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: 40, height: 40, borderRadius: 20 }} />
        ) : (
          <View style={{ backgroundColor: c.card }} className="w-10 h-10 rounded-full items-center justify-center">
            <Text style={{ color: c.text }} className="text-xs font-bold">{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {badgeColor && rating && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -8,
              backgroundColor: badgeColor,
              borderRadius: 7,
              paddingHorizontal: 4,
              paddingVertical: 1,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text className="text-white text-[9px] font-bold">{rating}</Text>
            {isPOTM && <Ionicons name="star" size={7} color="#fff" style={{ marginLeft: 1 }} />}
          </View>
        )}
        {subOffMinute != null && (
          <View
            style={{
              position: 'absolute',
              bottom: -2,
              left: -6,
              backgroundColor: '#ef4444',
              borderRadius: 7,
              width: 14,
              height: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={8} color="#fff" />
          </View>
        )}
      </View>
      <Text style={{ color: c.text }} className="text-[10px] font-semibold mt-1 text-center" numberOfLines={1}>
        {number} {lastName}
      </Text>
    </View>
  );
}

function HalfwayLine() {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center my-2">
      <View className="flex-1 h-px" style={{ backgroundColor: c.border }} />
      <View
        style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: c.border }}
      />
      <View className="flex-1 h-px" style={{ backgroundColor: c.border }} />
    </View>
  );
}

function LineupField({
  home,
  away,
  getEnrichment,
  potmPlayerId,
}: {
  home: TeamLineup;
  away: TeamLineup;
  getEnrichment: (playerId: number) => PlayerEnrichment;
  potmPlayerId: number | null;
}) {
  const c = useThemeColors();
  const homeRows = groupByGridRow(home.startXI, 'toHalfway');
  const awayRows = groupByGridRow(away.startXI, 'fromHalfway');

  return (
    <View className="mx-4 mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <TeamLogo uri={home.team.logo} size={18} />
          <Text style={{ color: c.text }} className="text-xs font-semibold ml-2">
            {home.team.name} · {home.formation}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text style={{ color: c.text }} className="text-xs font-semibold mr-2">
            {away.formation} · {away.team.name}
          </Text>
          <TeamLogo uri={away.team.logo} size={18} />
        </View>
      </View>

      <View style={{ backgroundColor: '#0F3D1F', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 4 }}>
        {homeRows.map(({ row, players }) => (
          <View key={`home-${row}`} className="flex-row justify-evenly mb-3">
            {players.map((entry) => (
              <PlayerChip
                key={entry.player.id}
                name={entry.player.name}
                number={entry.player.number}
                isPOTM={entry.player.id === potmPlayerId}
                enrichment={getEnrichment(entry.player.id)}
              />
            ))}
          </View>
        ))}

        <HalfwayLine />

        {awayRows.map(({ row, players }) => (
          <View key={`away-${row}`} className="flex-row justify-evenly mb-3">
            {players.map((entry) => (
              <PlayerChip
                key={entry.player.id}
                name={entry.player.name}
                number={entry.player.number}
                isPOTM={entry.player.id === potmPlayerId}
                enrichment={getEnrichment(entry.player.id)}
              />
            ))}
          </View>
        ))}
      </View>

      <View className="flex-row justify-between mt-2">
        <Text style={{ color: c.muted }} className="text-xs">Coach: {home.coach?.name ?? 'Unknown'}</Text>
        <Text style={{ color: c.muted }} className="text-xs">Coach: {away.coach?.name ?? 'Unknown'}</Text>
      </View>
    </View>
  );
}

function SubstituteRow({ entry, teamColor, enrichment }: { entry: LineupPlayerEntry; teamColor: string; enrichment: PlayerEnrichment }) {
  const c = useThemeColors();
  const initial = entry.player.name.charAt(0).toUpperCase();
  return (
    <View className="flex-row items-center py-1.5">
      {enrichment.photo ? (
        <Image source={{ uri: enrichment.photo }} style={{ width: 28, height: 28, borderRadius: 14 }} className="mr-2" />
      ) : (
        <View style={{ backgroundColor: c.card }} className="w-7 h-7 rounded-full items-center justify-center mr-2">
          <Text style={{ color: c.text }} className="text-[10px] font-bold">{initial}</Text>
        </View>
      )}
      <Text style={{ color: c.muted }} className="text-xs flex-1" numberOfLines={1}>
        {entry.player.number} · {entry.player.name}
      </Text>
      {enrichment.rating && (
        <View style={{ backgroundColor: teamColor, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text className="text-white text-[10px] font-bold">{enrichment.rating}</Text>
        </View>
      )}
    </View>
  );
}

function H2HSummaryBar({
  team1Name,
  team2Name,
  team1Wins,
  draws,
  team2Wins,
}: {
  team1Name: string;
  team2Name: string;
  team1Wins: number;
  draws: number;
  team2Wins: number;
}) {
  const c = useThemeColors();
  const total = Math.max(team1Wins + draws + team2Wins, 1);

  return (
    <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="border rounded-lg px-4 py-3 mb-3 mx-4">
      <View className="flex-row justify-between mb-2">
        <Text style={{ color: c.text }} className="text-xs font-semibold" numberOfLines={1}>
          {team1Name}
        </Text>
        <Text style={{ color: c.muted }} className="text-xs">Draws</Text>
        <Text style={{ color: c.text }} className="text-xs font-semibold" numberOfLines={1}>
          {team2Name}
        </Text>
      </View>
      <View className="flex-row items-center mb-2">
        <Text style={{ color: c.primary }} className="text-lg font-bold w-8 text-center">{team1Wins}</Text>
        <Text style={{ color: c.muted }} className="text-lg font-bold flex-1 text-center">{draws}</Text>
        <Text style={{ color: '#ef4444' }} className="text-lg font-bold w-8 text-center">{team2Wins}</Text>
      </View>
      <View className="flex-row h-2 rounded-full overflow-hidden">
        <View style={{ flex: team1Wins / total, backgroundColor: c.primary }} />
        <View style={{ flex: draws / total, backgroundColor: c.muted }} />
        <View style={{ flex: team2Wins / total, backgroundColor: '#ef4444' }} />
      </View>
    </View>
  );
}

function H2HMatchRow({ match }: { match: Match }) {
  const c = useThemeColors();
  return (
    <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="border rounded-lg px-4 py-3 mb-2 mx-4">
      <Text style={{ color: c.muted }} className="text-xs mb-1">{formatShortDate(match.kickoff_time)}</Text>
      <View className="flex-row items-center justify-between">
        <Text style={{ color: c.text }} className="text-sm flex-1" numberOfLines={1}>
          {match.home_team}
        </Text>
        <Text style={{ color: c.text }} className="text-sm font-bold px-3">
          {match.home_score ?? '-'} - {match.away_score ?? '-'}
        </Text>
        <Text style={{ color: c.text }} className="text-sm flex-1 text-right" numberOfLines={1}>
          {match.away_team}
        </Text>
      </View>
    </View>
  );
}

function TeamFormRow({ teamName, form }: { teamName: string; form: TeamFormEntry[] }) {
  const c = useThemeColors();
  return (
    <View className="mb-4">
      <Text style={{ color: c.text }} className="text-sm font-semibold mb-2" numberOfLines={1}>
        {teamName}
      </Text>
      <View className="flex-row">
        {form.length === 0 ? (
          <Text style={{ color: c.muted }} className="text-xs">No recent finished matches</Text>
        ) : (
          form.map((entry) => <FormChip key={entry.match_id} result={entry.result} />)
        )}
      </View>
    </View>
  );
}

function ScoreDivider({ label, score }: { label: string; score: string }) {
  const c = useThemeColors();
  return (
    <View className="items-center my-3">
      <View className="flex-row items-center">
        <View style={{ borderColor: c.border, backgroundColor: c.surface }} className="w-9 h-9 rounded-full border-2 items-center justify-center mr-2">
          <Text style={{ color: c.text }} className="text-[10px] font-bold">{label}</Text>
        </View>
        <Text style={{ color: c.text }} className="text-sm font-semibold">{score}</Text>
      </View>
    </View>
  );
}

// API-Football's `subst` events store the player going OFF in `player` and
// the player coming ON in `assist` (verified against api-sports.io docs —
// not the same convention as a goal's assist field). Two-column layout:
// home team's events render on the left, away team's on the right, each
// row's minute sitting at the outer screen edge, matching FotMob's Facts tab.
function FactsEventRow({ event, side, scoreLabel }: { event: MatchEventItem; side: 'left' | 'right'; scoreLabel?: string }) {
  const c = useThemeColors();
  const isGoal = event.event_type === 'goal';
  const isMissedPenalty = isGoal && (event.detail ?? '').toLowerCase().includes('missed');
  const isSub = event.event_type === 'substitution';
  const rowDirection = side === 'left' ? 'row' : 'row-reverse';
  const align = side === 'left' ? 'flex-start' : 'flex-end';

  let content;
  if (isSub) {
    content = (
      <View style={{ alignItems: align }}>
        <View className="flex-row items-center mb-0.5" style={{ flexDirection: rowDirection }}>
          <Ionicons name="arrow-forward-circle" size={14} color={c.primary} />
          <Text style={{ color: c.primary }} className="text-xs font-medium mx-1" numberOfLines={1}>
            {event.assist_player ?? '—'}
          </Text>
        </View>
        <View className="flex-row items-center" style={{ flexDirection: rowDirection }}>
          <Ionicons name="arrow-back-circle" size={14} color="#ef4444" />
          <Text style={{ color: '#ef4444' }} className="text-xs font-medium mx-1" numberOfLines={1}>
            {event.player}
          </Text>
        </View>
      </View>
    );
  } else if (isGoal) {
    content = (
      <View style={{ alignItems: align }}>
        <View className="flex-row items-center" style={{ flexDirection: rowDirection }}>
          <Text className="text-sm mx-1">{isMissedPenalty ? '❌' : '⚽'}</Text>
          <Text style={{ color: c.text }} className="text-sm font-medium" numberOfLines={1}>
            {event.player}
            {!isMissedPenalty && scoreLabel ? ` (${scoreLabel})` : ''}
          </Text>
        </View>
        {(isMissedPenalty || event.assist_player || (event.detail && event.detail !== 'Normal Goal')) && (
          <Text style={{ color: c.muted }} className="text-xs mt-0.5" numberOfLines={1}>
            {isMissedPenalty ? 'Missed penalty' : event.assist_player ? `Assist by ${event.assist_player}` : event.detail}
          </Text>
        )}
      </View>
    );
  } else {
    content = (
      <View className="flex-row items-center" style={{ flexDirection: rowDirection }}>
        <Text className="text-sm mx-1">{EVENT_ICONS[event.event_type] ?? EVENT_ICONS.other}</Text>
        <Text style={{ color: c.text }} className="text-sm font-medium" numberOfLines={1}>
          {event.player}
        </Text>
      </View>
    );
  }

  const minuteLabel = (
    <Text style={{ color: c.muted, width: 30, textAlign: side === 'left' ? 'left' : 'right' }} className="text-xs">
      {event.minute}'
    </Text>
  );

  return (
    <View className="flex-row items-center px-4 py-2">
      {side === 'left' && minuteLabel}
      <View style={{ flex: 1, alignItems: align, paddingHorizontal: 8 }}>{content}</View>
      {side === 'right' && minuteLabel}
    </View>
  );
}

function parsePercent(value: string | number | null): number | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function PossessionBar({
  homeValue,
  awayValue,
  homeColor,
  awayColor,
}: {
  homeValue: string | number | null;
  awayValue: string | number | null;
  homeColor: string;
  awayColor: string;
}) {
  const c = useThemeColors();
  const homePct = parsePercent(homeValue);
  const awayPct = parsePercent(awayValue);

  if (homePct == null || awayPct == null) {
    return <StatRow label="Ball Possession" homeValue={homeValue} awayValue={awayValue} homeColor={homeColor} awayColor={awayColor} />;
  }

  return (
    <View className="px-4 py-3 mb-2">
      <View className="flex-row justify-between mb-1.5">
        <Text style={{ color: homeColor }} className="text-xs font-bold">{homePct}%</Text>
        <Text style={{ color: c.muted }} className="text-[10px] font-semibold uppercase">Possession</Text>
        <Text style={{ color: awayColor }} className="text-xs font-bold">{awayPct}%</Text>
      </View>
      <View className="flex-row h-2 rounded-full overflow-hidden">
        <View style={{ flex: homePct, backgroundColor: homeColor }} />
        <View style={{ flex: awayPct, backgroundColor: awayColor }} />
      </View>
    </View>
  );
}

function StatRow({
  label,
  homeValue,
  awayValue,
  homeColor,
  awayColor,
}: {
  label: string;
  homeValue: string | number | null;
  awayValue: string | number | null;
  homeColor: string;
  awayColor: string;
}) {
  const c = useThemeColors();
  return (
    <View className="flex-row items-center px-4 py-2">
      <Text style={{ color: homeColor }} className="text-sm font-semibold w-14" numberOfLines={1}>
        {homeValue ?? '-'}
      </Text>
      <Text style={{ color: c.muted }} className="text-xs flex-1 text-center" numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: awayColor }} className="text-sm font-semibold w-14 text-right" numberOfLines={1}>
        {awayValue ?? '-'}
      </Text>
    </View>
  );
}

function PlayerOfMatchCard({
  player,
  teamName,
  teamLogo,
  photo,
}: {
  player: MatchPlayerStat;
  teamName: string;
  teamLogo: string | null;
  photo: string | null;
}) {
  const c = useThemeColors();
  const initial = player.player_name.charAt(0).toUpperCase();
  return (
    <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="border rounded-lg px-4 py-3 mb-3 mx-4">
      <Text style={{ color: c.muted }} className="text-xs font-semibold uppercase mb-3">Player of the Match</Text>
      <View className="flex-row items-center">
        <View style={{ width: 48, height: 48 }} className="mr-3">
          {photo ? (
            <Image source={{ uri: photo }} style={{ width: 48, height: 48, borderRadius: 24 }} />
          ) : (
            <View style={{ backgroundColor: c.card }} className="w-12 h-12 rounded-full items-center justify-center">
              <Text style={{ color: c.text }} className="text-lg font-bold">{initial}</Text>
            </View>
          )}
          <View
            style={{
              backgroundColor: c.blue500,
              position: 'absolute',
              top: -4,
              right: -8,
              borderRadius: 8,
              paddingHorizontal: 5,
              paddingVertical: 1,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text className="text-white text-[10px] font-bold mr-0.5">{player.rating}</Text>
            <Ionicons name="star" size={8} color="#fff" />
          </View>
        </View>
        <View className="flex-1">
          <Text style={{ color: c.text }} className="text-sm font-semibold">{player.player_name}</Text>
          <View className="flex-row items-center mt-0.5">
            {teamLogo && <Image source={{ uri: teamLogo }} style={{ width: 14, height: 14 }} className="mr-1" resizeMode="contain" />}
            <Text style={{ color: c.muted }} className="text-xs" numberOfLines={1}>
              {teamName}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function TopRatedRow({ stat, teamName, color, photo }: { stat: MatchPlayerStat; teamName: string; color: string; photo: string | null }) {
  const c = useThemeColors();
  const initial = stat.player_name.charAt(0).toUpperCase();
  return (
    <View className="flex-row items-center px-4 py-2">
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: 32, height: 32, borderRadius: 16 }} className="mr-3" />
      ) : (
        <View style={{ backgroundColor: c.card }} className="w-8 h-8 rounded-full items-center justify-center mr-3">
          <Text style={{ color: c.text }} className="text-xs font-bold">{initial}</Text>
        </View>
      )}
      <View className="flex-1">
        <Text style={{ color: c.text }} className="text-sm" numberOfLines={1}>
          {stat.player_name}
        </Text>
        <Text style={{ color: c.muted }} className="text-xs" numberOfLines={1}>
          {teamName}
        </Text>
      </View>
      <View style={{ backgroundColor: color, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text className="text-white text-xs font-bold">{stat.rating}</Text>
      </View>
    </View>
  );
}

export default function MatchDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const matchId = Number(params.id);

  const [activeTab, setActiveTab] = useState<Tab>('preview');
  const [openingChat, setOpeningChat] = useState(false);

  const { data: match, isLoading: matchLoading } = useMatch(matchId);
  const { data: odds, isLoading: oddsLoading } = useMatchOdds(matchId);
  const { data: lineup, isLoading: lineupLoading } = useMatchLineup(matchId);
  const { data: h2h, isLoading: h2hLoading } = useMatchH2H(matchId);
  const { data: preview, isLoading: previewLoading } = useMatchPreview(matchId);
  const { data: statistics, isLoading: statsLoading } = useMatchStatistics(matchId);
  const { data: playerStats } = useMatchPlayerStats(matchId);
  const { data: homeSquad } = useTeamSquad(match?.home_team_id ?? 0);
  const { data: awaySquad } = useTeamSquad(match?.away_team_id ?? 0);

  const isPostMatch = match ? match.status === 'finished' || match.status === 'live' : false;
  const tabs = isPostMatch ? POST_MATCH_TABS : PRE_MATCH_TABS;
  // Falls back to the first tab of the current set whenever the previously
  // selected tab isn't valid for it (e.g. the match just went live and
  // "Odds"/"Preview" are no longer in the tab list) — no effect needed,
  // this just recomputes on every render from the source of truth.
  const effectiveTab = tabs.some((t) => t.key === activeTab) ? activeTab : tabs[0].key;

  // Real club colors where known, deterministic per-name fallback otherwise
  // (see src/lib/teamColors.ts) — used for stats bars/badges, not app chrome.
  const homeColor = match ? getTeamColor(match.home_team) : c.primary;
  const awayColor = match ? getTeamColor(match.away_team) : c.muted;

  const bookmaker = odds?.data?.bookmakers?.[0];
  const primaryBets = (bookmaker?.bets ?? []).filter((bet) => PRIMARY_MARKET_IDS.includes(bet.id));

  const hasHalftimeScore = match?.halftime_home_score != null && match?.halftime_away_score != null;
  // Reverse-chronological (most recent first), matching FotMob — FT sits at
  // the top, HT is inserted at the 45'/46' boundary, kickoff at the bottom.
  const { firstHalfEvents, secondHalfEvents } = useMemo(() => {
    const all = [...(match?.events ?? [])].sort((a, b) => b.minute - a.minute);
    return {
      firstHalfEvents: all.filter((e) => e.minute > 45),
      secondHalfEvents: all.filter((e) => e.minute <= 45),
    };
  }, [match?.events]);

  // Running score at each goal, for the "(2-0)" label — own-goal attribution
  // isn't specially handled (not yet seen in real synced data to verify
  // against), missed penalties are excluded from the tally.
  const scoreAtGoal = useMemo(() => {
    const map = new Map<number, string>();
    if (!match) return map;
    const goals = [...match.events]
      .filter((e) => e.event_type === 'goal' && !(e.detail ?? '').toLowerCase().includes('missed'))
      .sort((a, b) => a.minute - b.minute || a.id - b.id);
    let home = 0;
    let away = 0;
    for (const g of goals) {
      if (g.team === match.home_team) home++;
      else away++;
      map.set(g.id, `${home}-${away}`);
    }
    return map;
  }, [match]);

  const homeStats = statistics?.find((s) => s.team.id === match?.home_team_id);
  const awayStats = statistics?.find((s) => s.team.id === match?.away_team_id);
  const getStat = (teamStats: MatchStatistic | undefined, type: string) =>
    teamStats?.statistics.find((s) => s.type === type)?.value ?? null;

  // Bench players who didn't feature have a null `rating` — only players who
  // actually played get ranked. Sorted once here and reused for both the
  // Player of the Match card and the Stats tab's rating leaderboard.
  const ratedPlayers = useMemo(() => {
    return (playerStats ?? [])
      .filter((p) => p.rating)
      .map((p) => ({ stat: p, ratingNum: parseFloat(p.rating as string) }))
      .filter((p) => !Number.isNaN(p.ratingNum))
      .sort((a, b) => b.ratingNum - a.ratingNum)
      .map((p) => p.stat);
  }, [playerStats]);

  const getStatTeamInfo = (teamId: number) =>
    match && teamId === match.home_team_id
      ? { name: match.home_team, logo: match.home_team_logo, color: homeColor }
      : { name: match?.away_team ?? '', logo: match?.away_team_logo ?? null, color: awayColor };

  const playerOfMatch = ratedPlayers[0];
  const topRatedPlayers = ratedPlayers.slice(0, 3);

  // Photo/rating lookup by API-Football player id — shared across the squad
  // (from /api/players/?team_id=) and match-stat rating endpoints, since
  // both use the same numeric ID space as the lineup data (verified).
  const photoById = useMemo(() => {
    const map = new Map<number, string | null>();
    [...(homeSquad ?? []), ...(awaySquad ?? [])].forEach((p) => map.set(p.api_football_id, p.photo));
    return map;
  }, [homeSquad, awaySquad]);

  const ratingById = useMemo(() => {
    const map = new Map<number, string | null>();
    (playerStats ?? []).forEach((p) => map.set(p.player_id, p.rating));
    return map;
  }, [playerStats]);

  // Substitution events store the OUT player in `player` (see FactsEventRow
  // comment) — keyed by team+name since MatchEvent has no player id.
  const subOffByKey = useMemo(() => {
    const map = new Map<string, number>();
    (match?.events ?? [])
      .filter((e) => e.event_type === 'substitution')
      .forEach((e) => map.set(`${e.team}|${e.player}`, e.minute));
    return map;
  }, [match?.events]);

  const getEnrichment = (playerId: number, teamName: string, playerName: string): PlayerEnrichment => ({
    photo: photoById.get(playerId) ?? null,
    rating: ratingById.get(playerId) ?? null,
    subOffMinute: subOffByKey.get(`${teamName}|${playerName}`) ?? null,
  });

  const homeLineupTeam = lineup?.data.find((t) => t.team.id === match?.home_team_id);
  const awayLineupTeam = lineup?.data.find((t) => t.team.id === match?.away_team_id);

  return (
    <View style={{ backgroundColor: c.bg }} className="flex-1">
      <View
        style={{ paddingTop: insets.top + 8, borderBottomColor: c.border }}
        className="flex-row items-center px-4 pb-3 border-b"
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3" hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={{ color: c.text }} className="text-lg font-bold flex-1" numberOfLines={1}>
          {match ? `${match.home_team} vs ${match.away_team}` : 'Match'}
        </Text>
        {/* MatchRoom chat entry (Step 9) — opens the match's conversation in
            the shared ChatThread screen. The /room/ endpoint lazily creates
            the room and auto-joins the requester, so this works for any match. */}
        {match && (
          <TouchableOpacity
            hitSlop={8}
            disabled={openingChat}
            onPress={async () => {
              try {
                setOpeningChat(true);
                const room = await getMatchRoom(matchId);
                router.push(`/(main)/(app)/chat/${room.conversation}` as Href);
              } catch (e) {
                Alert.alert('Chat unavailable', extractApiError(e));
              } finally {
                setOpeningChat(false);
              }
            }}
            style={{ borderColor: c.primary + '80', backgroundColor: c.primary + '1A' }}
            className="flex-row items-center gap-1.5 rounded-full border px-3 py-1.5"
          >
            <Ionicons name="chatbubbles-outline" size={14} color={c.primary} />
            <Text style={{ color: c.primary }} className="text-xs font-semibold">
              {openingChat ? '…' : 'Chat'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {matchLoading ? (
        <ActivityIndicator color={c.primary} className="mt-8" />
      ) : !match ? (
        <Text style={{ color: c.muted }} className="text-center mt-8 px-4">Match not found</Text>
      ) : (
        <>
          <View className="flex-row items-center justify-between px-6 py-4">
            <View className="items-center flex-1">
              <TeamLogo uri={match.home_team_logo} />
              <Text style={{ color: c.text }} className="text-sm mt-2 text-center" numberOfLines={2}>
                {match.home_team}
              </Text>
            </View>

            <View className="items-center px-3">
              {match.status === 'scheduled' ? (
                <Text style={{ color: c.muted }} className="text-xs">{formatKickoff(match.kickoff_time)}</Text>
              ) : (
                <>
                  <Text style={{ color: c.text }} className="text-2xl font-bold">
                    {match.home_score ?? '-'} - {match.away_score ?? '-'}
                  </Text>
                  <Text
                    style={{ color: match.status === 'live' ? c.primary : c.muted }}
                    className={`text-xs mt-1 ${match.status === 'live' ? 'font-semibold' : ''}`}
                  >
                    {match.status === 'live' ? `${match.minute ?? 0}'` : 'FT'}
                  </Text>
                </>
              )}
            </View>

            <View className="items-center flex-1">
              <TeamLogo uri={match.away_team_logo} />
              <Text style={{ color: c.text }} className="text-sm mt-2 text-center" numberOfLines={2}>
                {match.away_team}
              </Text>
            </View>
          </View>

          {/* Live view (Step 8) — real-time score + event feed over the match
              WebSocket, only while the match is in play. */}
          {match.status === 'live' && (
            <LiveMatchPanel
              matchId={matchId}
              homeTeam={match.home_team}
              fallbackHome={match.home_score}
              fallbackAway={match.away_score}
              fallbackMinute={match.minute}
            />
          )}

          <View className="flex-row px-4 py-3 gap-2">
            {tabs.map((tab) => {
              const isActive = tab.key === effectiveTab;
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

          {effectiveTab === 'facts' && (
            <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
              {playerOfMatch && (
                <PlayerOfMatchCard
                  player={playerOfMatch}
                  teamName={getStatTeamInfo(playerOfMatch.team_id).name}
                  teamLogo={getStatTeamInfo(playerOfMatch.team_id).logo}
                  photo={photoById.get(playerOfMatch.player_id) ?? null}
                />
              )}
              {match.events.length === 0 ? (
                <Text style={{ color: c.muted }} className="text-center mt-8 px-4">
                  No events recorded for this match yet.
                </Text>
              ) : (
                <>
                  {match.status === 'finished' && (
                    <ScoreDivider label="FT" score={`${match.home_score ?? '-'} - ${match.away_score ?? '-'}`} />
                  )}
                  {/* Second half (46'+) — most recent first */}
                  {[...secondHalfEvents].map((e) => (
                    <FactsEventRow
                      key={e.id}
                      event={e}
                      side={e.team === match.home_team ? 'left' : 'right'}
                      scoreLabel={scoreAtGoal.get(e.id)}
                    />
                  ))}
                  {hasHalftimeScore && (
                    <ScoreDivider label="HT" score={`${match.halftime_home_score} - ${match.halftime_away_score}`} />
                  )}
                  {/* First half (1'-45') — most recent first */}
                  {firstHalfEvents.map((e) => (
                    <FactsEventRow
                      key={e.id}
                      event={e}
                      side={e.team === match.home_team ? 'left' : 'right'}
                      scoreLabel={scoreAtGoal.get(e.id)}
                    />
                  ))}
                </>
              )}
            </ScrollView>
          )}

          {effectiveTab === 'stats' &&
            (statsLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : !statistics || statistics.length < 2 ? (
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">
                Statistics not yet available for this match.
              </Text>
            ) : (
              <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
                <View className="flex-row items-center justify-between px-4 mb-1">
                  <Text style={{ color: homeColor }} className="text-xs font-semibold flex-1" numberOfLines={1}>
                    {match.home_team}
                  </Text>
                  <Text style={{ color: awayColor }} className="text-xs font-semibold flex-1 text-right" numberOfLines={1}>
                    {match.away_team}
                  </Text>
                </View>

                <PossessionBar
                  homeValue={getStat(homeStats, 'Ball Possession')}
                  awayValue={getStat(awayStats, 'Ball Possession')}
                  homeColor={homeColor}
                  awayColor={awayColor}
                />

                {STAT_GROUPS.map((group) => {
                  const rows = group.rows
                    .map((row) => ({
                      ...row,
                      homeValue: getStat(homeStats, row.type),
                      awayValue: getStat(awayStats, row.type),
                    }))
                    .filter((row) => row.homeValue != null || row.awayValue != null);

                  if (rows.length === 0) return null;

                  return (
                    <View key={group.section} className="mb-3">
                      <Text style={{ color: c.muted }} className="text-xs font-semibold uppercase px-4 mb-1 mt-2">
                        {group.section}
                      </Text>
                      {rows.map((row) => (
                        <StatRow
                          key={row.type}
                          label={row.label}
                          homeValue={row.homeValue}
                          awayValue={row.awayValue}
                          homeColor={homeColor}
                          awayColor={awayColor}
                        />
                      ))}
                    </View>
                  );
                })}

                {topRatedPlayers.length > 0 && (
                  <View className="mb-3">
                    <Text style={{ color: c.muted }} className="text-xs font-semibold uppercase px-4 mb-1 mt-2">
                      Player Ratings
                    </Text>
                    {topRatedPlayers.map((p) => (
                      <TopRatedRow
                        key={p.id}
                        stat={p}
                        teamName={getStatTeamInfo(p.team_id).name}
                        color={getStatTeamInfo(p.team_id).color}
                        photo={photoById.get(p.player_id) ?? null}
                      />
                    ))}
                  </View>
                )}
              </ScrollView>
            ))}

          {effectiveTab === 'lineup' &&
            (lineupLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : !homeLineupTeam || !awayLineupTeam ? (
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">
                Lineup not yet available for this match.
              </Text>
            ) : (
              <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
                <LineupField
                  home={homeLineupTeam}
                  away={awayLineupTeam}
                  potmPlayerId={playerOfMatch?.player_id ?? null}
                  getEnrichment={(playerId) => {
                    const homeEntry = homeLineupTeam.startXI.find((e) => e.player.id === playerId);
                    const teamName = homeEntry ? match.home_team : match.away_team;
                    const entry =
                      homeEntry ??
                      homeLineupTeam.substitutes.find((e) => e.player.id === playerId) ??
                      awayLineupTeam.startXI.find((e) => e.player.id === playerId) ??
                      awayLineupTeam.substitutes.find((e) => e.player.id === playerId);
                    return getEnrichment(playerId, teamName, entry?.player.name ?? '');
                  }}
                />

                <View className="mx-4 flex-row" style={{ gap: 16 }}>
                  <View className="flex-1">
                    <Text style={{ color: c.muted }} className="text-xs font-semibold uppercase mb-1">
                      {match.home_team} subs
                    </Text>
                    {homeLineupTeam.substitutes.map((entry) => (
                      <SubstituteRow
                        key={entry.player.id}
                        entry={entry}
                        teamColor={homeColor}
                        enrichment={getEnrichment(entry.player.id, match.home_team, entry.player.name)}
                      />
                    ))}
                  </View>
                  <View className="flex-1">
                    <Text style={{ color: c.muted }} className="text-xs font-semibold uppercase mb-1">
                      {match.away_team} subs
                    </Text>
                    {awayLineupTeam.substitutes.map((entry) => (
                      <SubstituteRow
                        key={entry.player.id}
                        entry={entry}
                        teamColor={awayColor}
                        enrichment={getEnrichment(entry.player.id, match.away_team, entry.player.name)}
                      />
                    ))}
                  </View>
                </View>
              </ScrollView>
            ))}

          {effectiveTab === 'h2h' &&
            (h2hLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : !h2h || h2h.matches.length === 0 ? (
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">No previous meetings found.</Text>
            ) : (
              <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
                <H2HSummaryBar
                  team1Name={match.home_team}
                  team2Name={match.away_team}
                  team1Wins={h2h.summary.team1_wins}
                  draws={h2h.summary.draws}
                  team2Wins={h2h.summary.team2_wins}
                />
                {h2h.matches.map((m) => (
                  <H2HMatchRow key={m.id} match={m} />
                ))}
              </ScrollView>
            ))}

          {effectiveTab === 'preview' &&
            (previewLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : !preview ? (
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">Preview not available.</Text>
            ) : (
              <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
                <View style={{ backgroundColor: c.surface, borderColor: c.border }} className="border rounded-lg px-4 py-3 mb-3 mx-4">
                  <Text style={{ color: c.text }} className="text-sm font-semibold mb-1">
                    {preview.venue_name ?? 'Venue TBD'}
                  </Text>
                  {preview.venue_city && (
                    <Text style={{ color: c.muted }} className="text-xs mb-2">{preview.venue_city}</Text>
                  )}
                  <Text style={{ color: c.muted }} className="text-xs">
                    Referee: {preview.referee ?? 'TBD'}
                  </Text>
                </View>

                <View className="mx-4">
                  <TeamFormRow teamName={match.home_team} form={preview.home_team_form} />
                  <TeamFormRow teamName={match.away_team} form={preview.away_team_form} />
                </View>
              </ScrollView>
            ))}

          {effectiveTab === 'odds' &&
            (oddsLoading ? (
              <ActivityIndicator color={c.primary} className="mt-8" />
            ) : primaryBets.length === 0 ? (
              <Text style={{ color: c.muted }} className="text-center mt-8 px-4">
                Odds not yet available for this match.
              </Text>
            ) : (
              <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 24 }}>
                {odds?.bookmaker_name && (
                  <Text style={{ color: c.muted }} className="text-xs px-4 mb-2">via {odds.bookmaker_name}</Text>
                )}
                {primaryBets.map((bet) => (
                  <OddsCard key={bet.id} bet={bet} />
                ))}
              </ScrollView>
            ))}
        </>
      )}
    </View>
  );
}
