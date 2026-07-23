import { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, SectionList, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMatchesByDate } from '../../../../src/hooks/useMatches';
import { useCoreLeagues } from '../../../../src/hooks/useLeagues';
import type { Match } from '../../../../src/api/leagueDetail';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type StatusTab = 'all' | 'live' | 'upcoming' | 'results';

function formatKickoff(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function MatchRow({ match, c }: { match: Match; c: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const showScore = isLive || isFinished;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => router.push(`/(main)/(app)/match/${match.id}` as Href)}
      style={{
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 10,
      }}
    >
      {/* League + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted }}>{match.league_name}</Text>
        {isLive ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#ef4444' }}>{match.minute ?? 0}'</Text>
          </View>
        ) : isFinished ? (
          <Text style={{ fontSize: 10, fontWeight: '600', color: c.muted, backgroundColor: c.gray100, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>FT</Text>
        ) : (
          <Text style={{ fontSize: 12, fontWeight: '600', color: c.primary }}>in {formatKickoff(match.kickoff_time)}</Text>
        )}
      </View>

      {/* Home */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
          {match.home_team_logo ? (
            <Image source={{ uri: match.home_team_logo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
          ) : <View style={{ width: 32, height: 32 }} />}
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, flex: 1 }} numberOfLines={1}>{match.home_team}</Text>
        </View>
        {showScore ? (
          <Text style={{ fontSize: 18, fontWeight: '800', color: isLive ? '#ef4444' : c.text, minWidth: 56, textAlign: 'center' }}>
            {match.home_score ?? '-'}
          </Text>
        ) : null}
      </View>

      {/* Away */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}>
          {match.away_team_logo ? (
            <Image source={{ uri: match.away_team_logo }} style={{ width: 32, height: 32 }} resizeMode="contain" />
          ) : <View style={{ width: 32, height: 32 }} />}
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, flex: 1 }} numberOfLines={1}>{match.away_team}</Text>
        </View>
        {showScore ? (
          <Text style={{ fontSize: 18, fontWeight: '800', color: isLive ? '#ef4444' : c.text, minWidth: 56, textAlign: 'center' }}>
            {match.away_score ?? '-'}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

type LeagueSection = { title: string; leagueLogo: string | null; data: Match[] };

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'results', label: 'Results' },
];

export default function MatchesScreen() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const c = useThemeColors();
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const season = new Date().getFullYear();
  const { data: matches, isLoading } = useMatchesByDate(today, season);
  const { data: coreLeagues } = useCoreLeagues();
  const leagueLogoById = useMemo(() => {
    const map = new Map<number, string | null>();
    (coreLeagues ?? []).forEach((league) => map.set(league.league_id, league.logo));
    return map;
  }, [coreLeagues]);
  const liveCount = useMemo(() => (matches ?? []).filter((m) => m.status === 'live').length, [matches]);

  const filteredMatches = useMemo(() => {
    let list = matches ?? [];
    if (activeTab === 'live') list = list.filter((m) => m.status === 'live');
    else if (activeTab === 'upcoming') list = list.filter((m) => m.status !== 'live' && m.status !== 'finished');
    else if (activeTab === 'results') list = list.filter((m) => m.status === 'finished');
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => m.home_team.toLowerCase().includes(q) || m.away_team.toLowerCase().includes(q) || (m.league_name && m.league_name.toLowerCase().includes(q)));
    }
    return list;
  }, [matches, activeTab, search]);

  const sections = useMemo<LeagueSection[]>(() => {
    const byLeague = new Map<string, Match[]>();
    filteredMatches.forEach((match) => {
      const key = match.league_name || match.league || 'Other';
      if (!byLeague.has(key)) byLeague.set(key, []);
      byLeague.get(key)!.push(match);
    });
    return Array.from(byLeague.entries())
      .map(([title, data]) => ({ title, leagueLogo: data[0]?.league_id ? leagueLogoById.get(data[0].league_id) ?? null : null, data: [...data].sort((a, b) => new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime()) }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [filteredMatches, leagueLogoById]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header - Trinity style */}
      <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: c.text, marginBottom: 4 }}>Matches</Text>
        <Text style={{ fontSize: 14, color: c.muted }}>Live scores, fixtures, and results.</Text>
      </View>

      {/* Search - Trinity style */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Ionicons name="search" size={16} color={c.muted} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, fontSize: 14, fontWeight: '500', color: c.text }}
            placeholder="Search teams or competitions…"
            placeholderTextColor={c.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Tabs - Trinity style: underline tabs */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, marginBottom: 20 }}>
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const badge = tab.key === 'live' ? liveCount : 0;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: isActive ? c.primary : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              {tab.key === 'live' && badge > 0 && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' }} />}
              <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? c.primary : c.muted }}>{tab.label}</Text>
              {tab.key === 'live' && badge > 0 && (
                <View style={{ backgroundColor: c.isDark ? '#450a0a' : '#fee2e2', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: c.isDark ? '#f87171' : '#b91c1c' }}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Match List */}
      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 48 }} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <MatchRow match={item} c={c} />}
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
              {section.leagueLogo && (
                <Image source={{ uri: section.leagueLogo }} style={{ width: 18, height: 18, marginRight: 8 }} resizeMode="contain" />
              )}
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>{section.title}</Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 80 }}>
              <Ionicons name="football-outline" size={40} color={c.gray300} />
              <Text style={{ fontWeight: '600', color: c.muted, marginTop: 12 }}>No matches found</Text>
              <Text style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>Try adjusting your filters.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
