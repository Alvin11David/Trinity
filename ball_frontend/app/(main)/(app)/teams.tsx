import { useState, useMemo } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchTeams, type FollowedTeam } from '../../../src/api/leagues';
import { useFollowedTeams, useToggleFollowTeam } from '../../../src/hooks/useLeagues';
import { useDebounce } from '../../../src/hooks/useDebounce';
import { useThemeColors } from '../../../src/hooks/useThemeColors';

const COUNTRY_FILTERS = ['All', 'England', 'Spain', 'Germany', 'Italy', 'France'] as const;
type CountryFilter = (typeof COUNTRY_FILTERS)[number];

interface TeamCardTeam { team_id: number; team_name: string; team_logo: string | null; }

function teamHref(team: TeamCardTeam): Href {
  return `/(main)/(app)/team/${team.team_id}?name=${encodeURIComponent(team.team_name)}&logo=${encodeURIComponent(team.team_logo ?? '')}` as Href;
}

function TeamCard({ team, isFollowing, onToggleFollow, isPending, c }: {
  team: TeamCardTeam; isFollowing: boolean; onToggleFollow: () => void; isPending: boolean; c: ReturnType<typeof useThemeColors>;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(teamHref(team))}
      style={{
        backgroundColor: c.card, borderWidth: 1, borderColor: c.border,
        borderRadius: 12, padding: 20, marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
        {team.team_logo ? (
          <Image source={{ uri: team.team_logo }} style={{ width: 56, height: 56 }} contentFit="contain" />
        ) : (
          <View style={{ width: 56, height: 56, borderRadius: 999, backgroundColor: c.gray100, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontWeight: '700', color: c.muted, fontSize: 18 }}>{team.team_name.charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: c.text }} numberOfLines={1}>{team.team_name}</Text>
            </View>
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onToggleFollow(); }}
              disabled={isPending}
              style={{
                flexShrink: 0, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
                backgroundColor: isFollowing ? c.primary : 'transparent',
                borderColor: isFollowing ? c.primary : c.border,
              }}
            >
              {isPending ? (
                <ActivityIndicator size="small" color={isFollowing ? '#fff' : c.muted} />
              ) : (
                <Text style={{ fontSize: 12, fontWeight: '700', color: isFollowing ? '#fff' : c.muted }}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function TeamsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = useThemeColors();
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<CountryFilter>('All');
  const debounced = useDebounce(query, 250);
  const toggleFollow = useToggleFollowTeam();
  const { data: followedTeams, isLoading: followedLoading } = useFollowedTeams();
  const followedIds = useMemo(() => new Set((followedTeams ?? []).map((t) => t.team_id)), [followedTeams]);
  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ['teams', 'browse', debounced],
    queryFn: () => searchTeams(debounced),
    enabled: debounced.trim().length >= 2,
    placeholderData: keepPreviousData,
  });
  const activeTeams = useMemo(() => {
    if (debounced.trim().length >= 2) return (searchResults ?? []) as TeamCardTeam[];
    return ((followedTeams ?? []) as FollowedTeam[]).map((t) => ({ team_id: t.team_id, team_name: t.team_name, team_logo: t.team_logo })) as TeamCardTeam[];
  }, [debounced, searchResults, followedTeams]);
  const isLoading = debounced.trim().length >= 2 ? searchLoading : followedLoading;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '900', color: c.text }}>Teams</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginTop: 2 }}>Follow your favourite clubs from around the world.</Text>
        </View>
      </View>

      {/* Search - Trinity style */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderWidth: 1.5, borderColor: c.border, borderRadius: 8, paddingHorizontal: 14 }}>
          <Ionicons name="search" size={16} color={c.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search teams or cities…" placeholderTextColor={c.muted} style={{ flex: 1, fontSize: 14, color: c.text, paddingHorizontal: 8, paddingVertical: 10 }} returnKeyType="search" autoCorrect={false} />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Country pills - Trinity style */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 8 }}>
        {COUNTRY_FILTERS.map((co) => {
          const active = countryFilter === co;
          return (
            <Pressable
              key={co}
              onPress={() => setCountryFilter(co)}
              style={{
                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                backgroundColor: active ? c.primary : 'transparent',
                borderColor: active ? c.primary : c.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : c.muted }}>{co}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Count */}
      <Text style={{ fontSize: 12, color: c.muted, fontWeight: '500', paddingHorizontal: 16, marginBottom: 12 }}>
        {activeTeams.length} team{activeTeams.length !== 1 ? 's' : ''}
      </Text>

      {/* Grid */}
      {isLoading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      ) : activeTeams.length > 0 ? (
        <FlatList
          data={activeTeams}
          keyExtractor={(item) => String(item.team_id)}
          numColumns={2}
          columnWrapperStyle={{ paddingHorizontal: 12, gap: 8 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <TeamCard team={item} isFollowing={followedIds.has(item.team_id)} onToggleFollow={() => toggleFollow.mutate(item.team_id)} isPending={toggleFollow.isPending} c={c} />
            </View>
          )}
        />
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🏟️</Text>
          <Text style={{ fontWeight: '600', color: c.muted }}>No teams found</Text>
          <Text style={{ fontSize: 14, color: c.muted, marginTop: 4 }}>Try a different search or country.</Text>
        </View>
      )}
    </View>
  );
}
