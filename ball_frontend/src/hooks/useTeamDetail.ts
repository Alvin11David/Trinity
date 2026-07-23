import { useQuery } from '@tanstack/react-query';
import { getTeamProfile, getTeamTM, getTeamMatches, getTeamSquad, getTeamStatistics } from '../api/teamDetail';

export const useTeamProfile = (teamId: number) => {
  return useQuery({
    queryKey: ['team-profile', teamId],
    queryFn: () => getTeamProfile(teamId),
    enabled: !!teamId,
  });
};

// Transfermarkt gap-fill (squad market value). 404s for teams not in the Team
// table are swallowed to a null-ish disabled state by the component.
export const useTeamTM = (teamId: number) => {
  return useQuery({
    queryKey: ['team-tm', teamId],
    queryFn: () => getTeamTM(teamId),
    enabled: !!teamId,
    retry: false,
  });
};

export const useTeamMatches = (teamId: number) => {
  return useQuery({
    queryKey: ['team-matches', teamId],
    queryFn: () => getTeamMatches(teamId),
    enabled: !!teamId,
  });
};

export const useTeamSquad = (teamId: number) => {
  return useQuery({
    queryKey: ['team-squad', teamId],
    queryFn: () => getTeamSquad(teamId),
    enabled: !!teamId,
  });
};

export const useTeamStatistics = (leagueId: number, teamId: number, season: number) => {
  return useQuery({
    queryKey: ['team-statistics', leagueId, teamId, season],
    queryFn: () => getTeamStatistics(leagueId, teamId, season),
    enabled: !!leagueId && !!teamId && !!season,
  });
};
