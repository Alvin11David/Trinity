import { apiClient } from './client';

export interface League {
  id: number;
  league_id: number;
  name: string;
  league_type: string | null;
  logo: string | null;
  country_name: string | null;
  country_code: string | null;
  country_flag: string | null;
  current_season: number | null;
  is_core_league: boolean;
  is_following: boolean;
  updated_at: string;
}

export const getLeagues = async (params?: { search?: string; country?: string; core_only?: boolean }) => {
  // This screen only ever shows the curated/featured league set — hardcoded
  // here (not left to call sites) so it can't be forgotten at a new call site.
  const response = await apiClient.get<League[]>('/api/leagues/', {
    params: { ...params, featured_only: true },
  });
  return response.data;
};

export interface CountryGroup {
  country_name: string;
  country_flag: string | null;
  leagues: League[];
}

export const getLeaguesGroupedByCountry = async (): Promise<CountryGroup[]> => {
  const response = await apiClient.get<League[]>('/api/leagues/', { params: { featured_only: 'true' } });
  const leagues = response.data;

  const grouped = new Map<string, CountryGroup>();
  for (const league of leagues) {
    const key = league.country_name || 'Unknown';
    if (!grouped.has(key)) {
      grouped.set(key, {
        country_name: key,
        country_flag: league.country_flag,
        leagues: [],
      });
    }
    grouped.get(key)!.leagues.push(league);
  }

  return Array.from(grouped.values()).sort((a, b) => a.country_name.localeCompare(b.country_name));
};

export const toggleFollowLeague = async (leagueId: number) => {
  const response = await apiClient.post(`/api/leagues/${leagueId}/follow/`);
  return response.data;
};

export const getFollowedLeagues = async () => {
  const response = await apiClient.get<League[]>('/api/leagues/following/');
  return response.data;
};

// Distinct teams for the favorite-team picker (there's no Team model — this is
// sourced from LeagueStanding server-side). Returns whatever's synced, so it
// grows as more leagues sync in.
export interface TeamResult {
  team_id: number;
  team_name: string;
  team_logo: string | null;
}

export const searchTeams = async (q: string): Promise<TeamResult[]> => {
  const response = await apiClient.get<TeamResult[]>('/api/leagues/teams/search/', {
    params: { q },
  });
  return response.data;
};

// A user's followed teams (UserTeamFollowSerializer) — powers the
// Leagues-search empty-state quick-access alongside followed leagues.
export interface FollowedTeam {
  id: number;
  team_id: number;
  team_name: string;
  team_logo: string | null;
  order: number;
  created_at: string;
}

export const getFollowedTeams = async (): Promise<FollowedTeam[]> => {
  const response = await apiClient.get<FollowedTeam[]>('/api/leagues/teams/following/');
  return response.data;
};

export const toggleFollowTeam = async (teamId: number) => {
  const response = await apiClient.post(`/api/leagues/teams/${teamId}/follow/`);
  return response.data;
};
