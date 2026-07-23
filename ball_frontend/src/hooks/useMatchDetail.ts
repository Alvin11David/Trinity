import { useQuery } from '@tanstack/react-query';
import {
  getMatch,
  getMatchOdds,
  getMatchLineup,
  getMatchH2H,
  getMatchPreview,
  getMatchStatistics,
  getMatchPlayerStats,
} from '../api/matchDetail';

export const useMatch = (matchId: number) => {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatch(matchId),
    enabled: !!matchId,
  });
};

export const useMatchOdds = (matchId: number) => {
  return useQuery({
    queryKey: ['match-odds', matchId],
    queryFn: () => getMatchOdds(matchId),
    enabled: !!matchId,
  });
};

export const useMatchLineup = (matchId: number) => {
  return useQuery({
    queryKey: ['match-lineup', matchId],
    queryFn: () => getMatchLineup(matchId),
    enabled: !!matchId,
  });
};

export const useMatchH2H = (matchId: number) => {
  return useQuery({
    queryKey: ['match-h2h', matchId],
    queryFn: () => getMatchH2H(matchId),
    enabled: !!matchId,
  });
};

export const useMatchPreview = (matchId: number) => {
  return useQuery({
    queryKey: ['match-preview', matchId],
    queryFn: () => getMatchPreview(matchId),
    enabled: !!matchId,
  });
};

export const useMatchStatistics = (matchId: number) => {
  return useQuery({
    queryKey: ['match-statistics', matchId],
    queryFn: () => getMatchStatistics(matchId),
    enabled: !!matchId,
  });
};

export const useMatchPlayerStats = (matchId: number) => {
  return useQuery({
    queryKey: ['match-player-stats', matchId],
    queryFn: () => getMatchPlayerStats(matchId),
    enabled: !!matchId,
  });
};
