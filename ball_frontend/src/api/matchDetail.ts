import axios from 'axios';
import { apiClient } from './client';
import type { Match } from './leagueDetail';
export type { MatchEventItem } from './leagueDetail';

export const getMatch = async (matchId: number) => {
  const response = await apiClient.get<Match>(`/api/matches/${matchId}/`);
  return response.data;
};

export interface MatchStatistic {
  team: { id: number; name: string; logo: string };
  statistics: { type: string; value: string | number | null }[];
}

export const getMatchStatistics = async (matchId: number): Promise<MatchStatistic[] | null> => {
  try {
    const response = await apiClient.get<{ statistics: MatchStatistic[] }>(`/api/matches/${matchId}/statistics/`);
    return response.data.statistics;
  } catch (error) {
    // No statistics synced yet is an expected, non-error state — but a real
    // failure (500, network error, auth) should surface, not get silently
    // treated as "not yet available."
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export interface OddsValue {
  value: string;
  odd: string;
}

export interface OddsBet {
  id: number;
  name: string;
  values: OddsValue[];
}

export interface OddsBookmaker {
  id: number;
  name: string;
  bets: OddsBet[];
}

export interface MatchOdds {
  id: number;
  match: number;
  bookmaker_name: string;
  // Raw API-Football fixture-odds payload — one bookmaker's `bets` array is
  // what the Odds tab actually renders (see matches/tasks.py::sync_odds_for_match).
  data: { bookmakers: OddsBookmaker[] };
  updated_at: string;
}

export const getMatchOdds = async (matchId: number): Promise<MatchOdds | null> => {
  try {
    const response = await apiClient.get<MatchOdds>(`/api/matches/${matchId}/odds/`);
    return response.data;
  } catch (error) {
    // No odds synced yet for this match is an expected, non-error state
    // (also the normal case outside API-Football's ~7-day odds window).
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export interface LineupPlayer {
  id: number;
  name: string;
  number: number;
  pos: string;
  grid: string | null;
}

export interface LineupPlayerEntry {
  player: LineupPlayer;
}

export interface TeamLineup {
  team: { id: number; name: string; logo: string };
  coach: { id: number; name: string; photo: string | null };
  formation: string;
  startXI: LineupPlayerEntry[];
  substitutes: LineupPlayerEntry[];
}

export interface MatchLineup {
  id: number;
  match: number;
  data: TeamLineup[];
  updated_at: string;
}

export const getMatchLineup = async (matchId: number): Promise<MatchLineup | null> => {
  try {
    const response = await apiClient.get<MatchLineup>(`/api/matches/${matchId}/lineup/`);
    return response.data;
  } catch (error) {
    // No lineup posted yet is expected — API-Football only posts lineups
    // ~30-60 min before kickoff.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export interface H2HSummary {
  team1_id: number;
  team2_id: number;
  team1_wins: number;
  draws: number;
  team2_wins: number;
}

export interface H2HResponse {
  summary: H2HSummary;
  matches: Match[];
}

export const getMatchH2H = async (matchId: number) => {
  const response = await apiClient.get<H2HResponse>(`/api/matches/${matchId}/h2h/`);
  return response.data;
};

export interface TeamFormEntry {
  match_id: number;
  result: 'W' | 'D' | 'L' | null;
  opponent: string;
  home_score: number | null;
  away_score: number | null;
  kickoff_time: string;
}

export interface MatchPreview {
  venue_name: string | null;
  venue_city: string | null;
  referee: string | null;
  home_team_form: TeamFormEntry[];
  away_team_form: TeamFormEntry[];
}

export const getMatchPreview = async (matchId: number) => {
  const response = await apiClient.get<MatchPreview>(`/api/matches/${matchId}/preview/`);
  return response.data;
};

export interface MatchPlayerStat {
  id: number;
  player_id: number;
  player_name: string;
  team_id: number;
  minutes: number | null;
  rating: string | null;
  position: string | null;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
}

export const getMatchPlayerStats = async (matchId: number) => {
  const response = await apiClient.get<MatchPlayerStat[]>(`/api/matches/${matchId}/player-stats/`);
  return response.data;
};
