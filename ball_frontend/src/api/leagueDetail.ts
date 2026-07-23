import { apiClient } from './client';

export interface Standing {
  id: number;
  league_id: number;
  league_name: string;
  season: number;
  team_id: number;
  team_name: string;
  team_logo: string | null;
  rank: number;
  points: number;
  goals_diff: number;
  form: string | null;
  description: string | null;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goals_for: number;
  goals_against: number;
  updated_at: string;
}

export interface MatchEventItem {
  id: number;
  event_type: string;
  team: string;
  player: string;
  minute: number;
  detail: string;
  assist_player: string | null;
}

export interface Match {
  id: number;
  api_football_id: number;
  league: string;
  league_id: number | null;
  league_name: string | null;
  round: string | null;
  season: number | null;
  home_team: string;
  away_team: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_team_logo: string | null;
  away_team_logo: string | null;
  kickoff_time: string;
  status: string;
  status_short: string | null;
  minute: number | null;
  venue_name: string | null;
  venue_city: string | null;
  referee: string | null;
  home_score: number | null;
  away_score: number | null;
  halftime_home_score: number | null;
  halftime_away_score: number | null;
  winnie_prediction: any;
  events: MatchEventItem[];
  has_room: boolean;
  updated_at: string;
}

export interface PlayerFullStats {
  team?: { id: number; name: string; logo: string | null };
  league?: { id: number; name: string; country: string; logo: string | null; flag: string | null; season: number };
  games?: {
    appearences: number | null;
    lineups: number | null;
    minutes: number | null;
    number: number | null;
    position: string | null;
    rating: string | null;
    captain: boolean;
  };
  substitutes?: { in: number | null; out: number | null; bench: number | null };
  shots?: { total: number | null; on: number | null };
  goals?: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
  passes?: { total: number | null; key: number | null; accuracy: number | null };
  tackles?: { total: number | null; blocks: number | null; interceptions: number | null };
  duels?: { total: number | null; won: number | null };
  dribbles?: { attempts: number | null; success: number | null; past: number | null };
  fouls?: { drawn: number | null; committed: number | null };
  cards?: { yellow: number | null; yellowred: number | null; red: number | null };
  penalty?: { won: number | null; commited: number | null; scored: number | null; missed: number | null; saved: number | null };
}

export interface PlayerLeagueStat {
  id: number;
  league_id: number;
  season: number;
  player_id: number;
  player_name: string;
  player_photo: string | null;
  team_id: number;
  team_name: string;
  team_logo: string | null;
  goals: number;
  assists: number;
  appearances: number;
  rank_type: string;
  rank_position: number;
  full_stats: PlayerFullStats | null;
}

export const getStandings = async (leagueId: number, season: number) => {
  const response = await apiClient.get<Standing[]>('/api/leagues/standings/', {
    params: { league_id: leagueId, season },
  });
  return response.data;
};

export const getLeagueMatches = async (leagueId: number) => {
  const response = await apiClient.get<Match[]>(`/api/matches/league/${leagueId}/`);
  return response.data;
};

export const getPlayerStats = async (leagueId: number, season: number, rankType: 'scorer' | 'assist') => {
  const response = await apiClient.get<PlayerLeagueStat[]>('/api/leagues/player-stats/', {
    params: { league_id: leagueId, season, rank_type: rankType },
  });
  return response.data;
};

export interface TeamStatistics {
  id: number;
  league_id: number;
  team_id: number;
  season: number;
  team_name: string;
  team_logo: string | null;
  form: string;
  data: {
    goals?: { for?: { total?: { total?: number } }; against?: { total?: { total?: number } } };
    clean_sheet?: { total?: number };
    failed_to_score?: { total?: number };
    penalty?: { scored?: { total?: number } };
    cards?: {
      yellow?: Record<string, { total: number | null }>;
      red?: Record<string, { total: number | null }>;
    };
    biggest?: {
      wins?: { home?: string; away?: string };
      loses?: { home?: string; away?: string };
      streak?: { wins?: number; draws?: number; loses?: number };
    };
  };
}

export const getTeamStatsLeaderboard = async (leagueId: number, season: number) => {
  const response = await apiClient.get<TeamStatistics[]>('/api/leagues/team-stats/leaderboard/', {
    params: { league_id: leagueId, season },
  });
  return response.data;
};
