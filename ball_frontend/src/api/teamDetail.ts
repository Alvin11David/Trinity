import { apiClient } from './client';
import type { Match, TeamStatistics, PlayerFullStats } from './leagueDetail';

export interface TeamProfile {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string | null;
    founded: number | null;
    national: boolean;
    logo: string | null;
  };
  venue: {
    id: number | null;
    name: string | null;
    address: string | null;
    city: string | null;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  };
}

export interface Player {
  id: number;
  api_football_id: number;
  team_id: number;
  team_name: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
  nationality: string | null;
  birth_date: string | null;
  birth_place: string | null;
  height: string | null;
  weight: string | null;
  injured: boolean;
  statistics: PlayerFullStats[] | null;
  updated_at: string;
  // Transfermarkt enrichment — null until the TM sync matches this player.
  transfermarkt_id?: number | null;
  market_value_eur?: number | null;
  previous_value_eur?: number | null;
  contract_until?: string | null;
  preferred_foot?: string | null;
  agent?: string | null;
  tm_synced_at?: string | null;
}

// Transfermarkt gap-fill from the Team model (/api/teams/<id>/). Deliberately lean:
// identity/venue/squad-stats already come from API-Football (getTeamProfile / squad /
// statistics) — we only read what API-Football does NOT provide (squad market value).
export interface TeamTMData {
  api_football_id: number;
  transfermarkt_id: number | null;
  squad_value_eur: number | null;
  squad_acquisition_value_eur: number | null;
  tm_synced_at: string | null;
}

export const getTeamProfile = async (teamId: number) => {
  const response = await apiClient.get<TeamProfile>(`/api/matches/team/${teamId}/profile/`);
  return response.data;
};

export const getTeamTM = async (teamId: number) => {
  const response = await apiClient.get<TeamTMData>(`/api/teams/${teamId}/`);
  return response.data;
};

export const getTeamMatches = async (teamId: number) => {
  const response = await apiClient.get<Match[]>(`/api/matches/team/${teamId}/`);
  return response.data;
};

export const getTeamSquad = async (teamId: number) => {
  const response = await apiClient.get<Player[]>('/api/players/', {
    params: { team_id: teamId },
  });
  return response.data;
};

export const getTeamStatistics = async (leagueId: number, teamId: number, season: number) => {
  const response = await apiClient.get<TeamStatistics>('/api/leagues/team-stats/', {
    params: { league_id: leagueId, team_id: teamId, season },
  });
  return response.data;
};
