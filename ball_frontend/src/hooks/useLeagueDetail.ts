import { useQuery } from '@tanstack/react-query';
import { getStandings, getLeagueMatches, getPlayerStats, getTeamStatsLeaderboard } from '../api/leagueDetail';

export const useStandings = (leagueId: number, season: number) => {
  return useQuery({
    queryKey: ['standings', leagueId, season],
    queryFn: () => getStandings(leagueId, season),
    enabled: !!leagueId && !!season,
  });
};

export const useLeagueMatches = (leagueId: number) => {
  return useQuery({
    queryKey: ['league-matches', leagueId],
    queryFn: () => getLeagueMatches(leagueId),
    enabled: !!leagueId,
  });
};

export const usePlayerStats = (leagueId: number, season: number, rankType: 'scorer' | 'assist') => {
  return useQuery({
    queryKey: ['player-stats', leagueId, season, rankType],
    queryFn: () => getPlayerStats(leagueId, season, rankType),
    enabled: !!leagueId && !!season,
  });
};

export const useTeamStatsLeaderboard = (leagueId: number, season: number) => {
  return useQuery({
    queryKey: ['team-stats-leaderboard', leagueId, season],
    queryFn: () => getTeamStatsLeaderboard(leagueId, season),
    enabled: !!leagueId && !!season,
  });
};
