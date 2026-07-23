import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFootballSearch } from '../../../src/hooks/useFootballSearch';
import { useDebounce } from '../../../src/hooks/useDebounce';
import { useFollowedLeagues, useFollowedTeams } from '../../../src/hooks/useLeagues';
import { useCountries } from '../../../src/hooks/useCountries';
import { getFlagUrl } from '../../../src/lib/flags';
import { LeagueListItem } from '../../../src/components/LeagueListItem';
import { useThemeColors } from '../../../src/hooks/useThemeColors';
import type { PlayerResult } from '../../../src/api/footballSearch';
import type { TeamResult, FollowedTeam, CountryGroup } from '../../../src/api/leagues';

const SECTION_CAP = 6;

function teamHref(teamId: number, name: string, logo: string | null): Href {
  return `/(main)/(app)/team/${teamId}?name=${encodeURIComponent(name)}&logo=${encodeURIComponent(
    logo ?? '',
  )}` as Href;
}

function Crest({ uri, size = 36, c }: { uri: string | null; size?: number; c: ReturnType<typeof useThemeColors> }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" />;
  }
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.card }} />;
}

function TeamRow({ team, c }: { team: TeamResult; c: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(teamHref(team.team_id, team.team_name, team.team_logo))}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      <Crest uri={team.team_logo} c={c} />
      <Text style={{ fontSize: 15, fontWeight: '500', color: c.text, flex: 1 }} numberOfLines={1}>
        {team.team_name}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={c.muted} />
    </Pressable>
  );
}

function PlayerRow({ player, flag, c }: { player: PlayerResult; flag: string | null; c: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  const href =
    `/(main)/(app)/player/${player.api_football_id}?name=${encodeURIComponent(
      player.name,
    )}&photo=${encodeURIComponent(player.photo ?? '')}&teamId=${player.team_id}&teamName=${encodeURIComponent(
      player.team_name,
    )}&position=${encodeURIComponent(player.position ?? '')}` as Href;
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      {player.photo ? (
        <Image source={{ uri: player.photo }} style={{ width: 36, height: 36, borderRadius: 18 }} />
      ) : (
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontWeight: '600', color: c.muted }}>{player.name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: c.text }} numberOfLines={1}>
          {player.name}
        </Text>
        <Text style={{ fontSize: 12, color: c.muted }} numberOfLines={1}>
          {[player.team_name, player.position].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {flag && <Image source={{ uri: flag }} style={{ width: 20, height: 14 }} contentFit="cover" />}
      <Ionicons name="chevron-forward" size={16} color={c.muted} />
    </Pressable>
  );
}

function CountryRow({ group, flag, c }: { group: CountryGroup; flag: string | null; c: ReturnType<typeof useThemeColors> }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/(main)/(app)/country/${encodeURIComponent(group.country_name)}` as Href)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
    >
      {flag ? (
        <Image source={{ uri: flag }} style={{ width: 28, height: 20 }} contentFit="cover" />
      ) : (
        <View style={{ width: 28, height: 20, borderRadius: 4, backgroundColor: c.card }} />
      )}
      <Text style={{ fontSize: 15, fontWeight: '500', color: c.text, flex: 1 }} numberOfLines={1}>
        {group.country_name}
      </Text>
      <Text style={{ fontSize: 12, color: c.muted, marginRight: 4 }}>
        {group.leagues.length} {group.leagues.length === 1 ? 'league' : 'leagues'}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={c.muted} />
    </Pressable>
  );
}

function SectionHeader({ label, c }: { label: string; c: ReturnType<typeof useThemeColors> }) {
  return (
    <Text style={{ fontSize: 12, fontWeight: '600', color: c.muted, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>{label}</Text>
  );
}

export default function LeaguesSearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();

  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);
  const { data: countries } = useCountries();
  const results = useFootballSearch(debounced);

  const followedLeagues = useFollowedLeagues();
  const followedTeams = useFollowedTeams();

  const renderResults = () => {
    if (results.isFetching && !results.hasAny) {
      return <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />;
    }
    if (!results.hasAny) {
      return <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No results for "{debounced.trim()}"</Text>;
    }
    return (
      <>
        {results.teams.length > 0 && (
          <View>
            <SectionHeader label="Teams" c={c} />
            {results.teams.slice(0, SECTION_CAP).map((t) => (
              <TeamRow key={`t-${t.team_id}`} team={t} c={c} />
            ))}
          </View>
        )}
        {results.players.length > 0 && (
          <View>
            <SectionHeader label="Players" c={c} />
            {results.players.slice(0, SECTION_CAP).map((p) => (
              <PlayerRow key={`p-${p.api_football_id}`} player={p} flag={getFlagUrl(p.nationality, countries)} c={c} />
            ))}
          </View>
        )}
        {results.leagues.length > 0 && (
          <View>
            <SectionHeader label="Leagues" c={c} />
            <View style={{ paddingTop: 4 }}>
              {results.leagues.slice(0, SECTION_CAP).map((l) => (
                <LeagueListItem key={`l-${l.league_id}`} league={l} />
              ))}
            </View>
          </View>
        )}
        {results.countries.length > 0 && (
          <View>
            <SectionHeader label="Countries" c={c} />
            {results.countries.map((cg) => (
              <CountryRow key={`c-${cg.country_name}`} group={cg} flag={getFlagUrl(cg.country_name, countries)} c={c} />
            ))}
          </View>
        )}
      </>
    );
  };

  const renderEmptyState = () => {
    const leagues = followedLeagues.data ?? [];
    const teams = followedTeams.data ?? [];
    const loading = followedLeagues.isLoading || followedTeams.isLoading;

    if (loading) return <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />;

    if (leagues.length === 0 && teams.length === 0) {
      return (
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 48, paddingHorizontal: 32 }}>
          Search for teams, players, leagues and countries.
        </Text>
      );
    }

    return (
      <>
        {teams.length > 0 && (
          <View>
            <SectionHeader label="Your teams" c={c} />
            {teams.map((t: FollowedTeam) => (
              <TeamRow
                key={`ft-${t.team_id}`}
                team={{ team_id: t.team_id, team_name: t.team_name, team_logo: t.team_logo }}
                c={c}
              />
            ))}
          </View>
        )}
        {leagues.length > 0 && (
          <View>
            <SectionHeader label="Your leagues" c={c} />
            <View style={{ paddingTop: 4 }}>
              {leagues.map((l) => (
                <LeagueListItem key={`fl-${l.league_id}`} league={l} />
              ))}
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.card, borderRadius: 999, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={16} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search teams, players, leagues"
            placeholderTextColor={c.muted}
            style={{ flex: 1, fontSize: 14, color: c.text, paddingHorizontal: 8, paddingVertical: 10 }}
            autoFocus
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 32 }}>
        {results.enabled ? renderResults() : renderEmptyState()}
      </ScrollView>
    </View>
  );
}
