import { apiClient } from './client';

export interface PlayerStatistics {
  team: { id: number; name: string; logo: string | null };
  league: { id: number; name: string; country: string; logo: string | null; season: number };
  games: { appearences: number; lineups: number; minutes: number; number: number | null; position: string; rating: string | null; captain: boolean };
  goals: { total: number | null; conceded: number; assists: number | null; saves: number | null };
  shots: { total: number | null; on: number | null };
  passes: { total: number | null; key: number | null; accuracy: number | null };
  tackles: { total: number | null; blocks: number | null; interceptions: number | null };
  duels: { total: number | null; won: number | null };
  dribbles: { attempts: number | null; success: number | null; past: number | null };
  fouls: { drawn: number | null; committed: number | null };
  cards: { yellow: number; yellowred: number; red: number };
  penalty: { won: number | null; scored: number; missed: number; saved: number | null };
}

export interface PlayerProfile {
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
  statistics: PlayerStatistics[] | null;
  // Transfermarkt enrichment — null until the TM sync matches this player.
  transfermarkt_id: number | null;
  market_value_eur: number | null;
  previous_value_eur: number | null;
  contract_until: string | null; // ISO date
  preferred_foot: string | null; // "left" | "right" | "both"
  agent: string | null;
  tm_synced_at: string | null;
}

// Transfermarkt market-value time series point (for the MV chart).
export interface PlayerMarketValuePoint {
  date: string; // ISO date
  value_eur: number;
  tm_club_id: number | null;
  age: number | null;
  season_id: number | null;
}

// Transfermarkt career transfer. Club names/logos are resolved server-side from
// the TransfermarktClub cache (null when a club id hasn't been resolved yet).
export interface PlayerTransferItem {
  date: string | null;
  from_tm_club_id: number | null;
  to_tm_club_id: number | null;
  from_club: string | null;
  to_club: string | null;
  from_club_logo: string | null;
  to_club_logo: string | null;
  fee_eur: number | null; // 0 = free, null = unknown
  market_value_eur: number | null;
  transfer_type: string | null;
  season_id: number | null;
}

export interface PlayerMatchHistoryItem {
  id: number;
  match_summary: {
    kickoff_time: string;
    league_name: string;
    home_team: string;
    away_team: string;
    home_team_id: number | null;
    away_team_id: number | null;
    home_team_logo: string | null;
    away_team_logo: string | null;
    home_score: number | null;
    away_score: number | null;
  };
  team_id: number;
  minutes: number | null;
  rating: string | null;
  position: string | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  full_stats: any;
}

export const getPlayerProfile = async (playerId: number) => {
  const response = await apiClient.get<PlayerProfile[]>('/api/players/', { params: { player_id: playerId } });
  return response.data[0];
};

export const getPlayerMatchHistory = async (playerId: number) => {
  const response = await apiClient.get<PlayerMatchHistoryItem[]>(`/api/matches/player/${playerId}/history/`);
  return response.data;
};

// Transfermarkt enrichment endpoints (playerId = API-Football id). Empty arrays
// until the TM sync has matched this player.
export const getPlayerMarketValueHistory = async (playerId: number) => {
  const response = await apiClient.get<PlayerMarketValuePoint[]>(`/api/players/${playerId}/market-value-history/`);
  return response.data;
};

export const getPlayerTransfers = async (playerId: number) => {
  const response = await apiClient.get<PlayerTransferItem[]>(`/api/players/${playerId}/transfers/`);
  return response.data;
};
