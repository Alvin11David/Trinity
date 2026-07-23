import { useMemo, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLeagues, useFollowedLeagues, useLeaguesByCountry } from '../../../../src/hooks/useLeagues';
import { LeagueListItem } from '../../../../src/components/LeagueListItem';
import type { League, CountryGroup } from '../../../../src/api/leagues';
import { useThemeColors } from '../../../../src/hooks/useThemeColors';

type Row =
  | { kind: 'followingHeader' }
  | { kind: 'followingLoading' }
  | { kind: 'followingEmpty' }
  | { kind: 'followingItem'; league: League }
  | { kind: 'allHeader' }
  | { kind: 'allLoading' }
  | { kind: 'countryGroup'; group: CountryGroup };

export default function LeaguesScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const c = useThemeColors();
  const { data: followedLeagues, isLoading: followedLoading } = useFollowedLeagues();
  const { data: searchResults, isLoading: searchLoading } = useLeagues(search.length > 1 ? search : undefined);
  const { data: countryGroups, isLoading: countriesLoading } = useLeaguesByCountry();
  const showingSearch = search.length > 1;

  const rows = useMemo<Row[]>(() => {
    const result: Row[] = [{ kind: 'followingHeader' }];
    if (followedLoading) result.push({ kind: 'followingLoading' });
    else if (!followedLeagues || followedLeagues.length === 0) result.push({ kind: 'followingEmpty' });
    else followedLeagues.forEach((league) => result.push({ kind: 'followingItem', league }));
    result.push({ kind: 'allHeader' });
    if (countriesLoading) result.push({ kind: 'allLoading' });
    else (countryGroups ?? []).forEach((group) => result.push({ kind: 'countryGroup', group }));
    return result;
  }, [followedLeagues, followedLoading, countryGroups, countriesLoading]);

  const rowKey = (row: Row, index: number) => {
    switch (row.kind) {
      case 'followingItem': return `following-${row.league.id}`;
      case 'countryGroup': return `country-${row.group.country_name}`;
      default: return `${row.kind}-${index}`;
    }
  };

  const renderRow = ({ item }: { item: Row }) => {
    switch (item.kind) {
      case 'followingHeader':
        return (
          <View style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: c.text }}>Following</Text>
              <Ionicons name="star" size={16} color={c.primary} />
            </View>
            {followedLoading ? (
              <ActivityIndicator color={c.primary} style={{ paddingVertical: 16 }} />
            ) : !followedLeagues || followedLeagues.length === 0 ? (
              <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', paddingVertical: 16, paddingHorizontal: 16 }}>Follow leagues to see them here</Text>
            ) : (
              followedLeagues.map((league, i) => (
                <LeagueListItem key={league.id} league={league} />
              ))
            )}
          </View>
        );
      case 'followingLoading':
        return <ActivityIndicator color={c.primary} style={{ marginTop: 16, marginBottom: 8 }} />;
      case 'followingEmpty':
        return <Text style={{ fontSize: 14, color: c.muted, textAlign: 'center', paddingVertical: 8, paddingHorizontal: 16 }}>Follow leagues to see them here</Text>;
      case 'followingItem':
        return <LeagueListItem league={item.league} />;
      case 'allHeader':
        return (
          <Text style={{ fontSize: 11, fontWeight: '700', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
            All Competitions
          </Text>
        );
      case 'allLoading':
        return <ActivityIndicator color={c.primary} style={{ marginTop: 16 }} />;
      case 'countryGroup':
        return <LeagueListItem league={item.group.leagues?.[0] ?? ({} as League)} />;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Header - Trinity style */}
      <View style={{ paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: c.text, marginBottom: 4 }}>Leagues</Text>
        <Text style={{ fontSize: 14, color: c.muted }}>Standings, top scorers, and more.</Text>
      </View>

      {/* Search - Trinity style */}
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Ionicons name="search" size={16} color={c.muted} style={{ marginRight: 10 }} />
          <TextInput
            style={{ flex: 1, fontSize: 14, fontWeight: '500', color: c.text }}
            placeholder="Find leagues"
            placeholderTextColor={c.muted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={6}>
              <Ionicons name="close-circle" size={18} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Results */}
      {showingSearch ? (
        searchLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: 48 }} />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <LeagueListItem league={item} />}
            contentContainerStyle={{ paddingTop: 8 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 80 }}>
                <Ionicons name="search-outline" size={32} color={c.gray300} />
                <Text style={{ fontSize: 14, color: c.muted, marginTop: 12, textAlign: 'center' }}>No leagues found</Text>
              </View>
            }
          />
        )
      ) : (
        <FlatList
          data={rows}
          keyExtractor={rowKey}
          renderItem={renderRow}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}
