import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { searchPlayers, type PlayerResult } from '../api/footballSearch';
import {
  searchTeams,
  getLeagues,
  getLeaguesGroupedByCountry,
  type TeamResult,
  type League,
  type CountryGroup,
} from '../api/leagues';

// Fires only once past 1 char — a single letter matches almost everything.
const MIN_CHARS = 2;

export interface FootballSearchResult {
  teams: TeamResult[];
  players: PlayerResult[];
  leagues: League[];
  countries: CountryGroup[];
  isFetching: boolean;
  enabled: boolean;
  hasAny: boolean;
}

// Fans out to the three entity endpoints in parallel (teams/players/leagues),
// each an independent React Query so a slow one doesn't block the others.
// Countries aren't a network call — they're filtered from the same
// grouped-by-country list the Leagues tab already caches, so every country
// result is guaranteed to have featured leagues behind it.
export function useFootballSearch(q: string): FootballSearchResult {
  const query = q.trim();
  const enabled = query.length >= MIN_CHARS;

  const teams = useQuery({
    queryKey: ['fsearch', 'teams', query],
    queryFn: () => searchTeams(query),
    enabled,
    placeholderData: keepPreviousData,
  });

  const players = useQuery({
    queryKey: ['fsearch', 'players', query],
    queryFn: () => searchPlayers(query),
    enabled,
    placeholderData: keepPreviousData,
  });

  const leagues = useQuery({
    queryKey: ['fsearch', 'leagues', query],
    queryFn: () => getLeagues({ search: query }),
    enabled,
    placeholderData: keepPreviousData,
  });

  // Shares the Leagues tab's cache key so this is usually already warm.
  const countryGroups = useQuery({
    queryKey: ['leagues', 'by-country'],
    queryFn: getLeaguesGroupedByCountry,
  });

  const countries = useMemo<CountryGroup[]>(() => {
    if (!enabled || !countryGroups.data) return [];
    const needle = query.toLowerCase();
    return countryGroups.data
      .filter((c) => c.country_name.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [enabled, query, countryGroups.data]);

  const teamsData = teams.data ?? [];
  const playersData = players.data ?? [];
  const leaguesData = leagues.data ?? [];

  return {
    teams: teamsData,
    players: playersData,
    leagues: leaguesData,
    countries,
    isFetching: enabled && (teams.isFetching || players.isFetching || leagues.isFetching),
    enabled,
    hasAny:
      teamsData.length > 0 ||
      playersData.length > 0 ||
      leaguesData.length > 0 ||
      countries.length > 0,
  };
}
