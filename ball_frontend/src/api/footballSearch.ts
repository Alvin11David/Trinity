import { apiClient } from './client';

// Leagues-tab entity search — players. Teams reuse `searchTeams` and leagues
// reuse `getLeagues({ search })` (both in ./leagues); countries are filtered
// client-side from the grouped-by-country list. This module only adds the one
// endpoint that didn't already exist server-side.
//
// Lean shape (no `statistics` blob) — matches PlayerSearchSerializer. Only
// synced players surface, so results grow as more squads sync in.
export interface PlayerResult {
  api_football_id: number;
  name: string;
  team_id: number;
  team_name: string;
  position: string | null;
  photo: string | null;
  nationality: string | null;
}

export const searchPlayers = async (q: string): Promise<PlayerResult[]> => {
  const { data } = await apiClient.get<PlayerResult[]>('/api/players/search/', {
    params: { q },
  });
  return data;
};

// Richer shape for the Players browse/discovery page — matches
// PlayerBrowseSerializer. Includes age, number, height, and Transfermarkt
// market value alongside the lean search fields.
export interface PlayerBrowseResult {
  api_football_id: number;
  name: string;
  team_id: number;
  team_name: string;
  position: string | null;
  photo: string | null;
  nationality: string | null;
  age: number | null;
  number: number | null;
  height: string | null;
  market_value_eur: number | null;
}

export const browsePlayers = async (params: {
  q?: string;
  position?: string;
}): Promise<PlayerBrowseResult[]> => {
  const { data } = await apiClient.get<PlayerBrowseResult[]>('/api/players/browse/', {
    params,
  });
  return data;
};
