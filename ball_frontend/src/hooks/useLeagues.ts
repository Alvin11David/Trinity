import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLeagues, getLeaguesGroupedByCountry, toggleFollowLeague, getFollowedLeagues, getFollowedTeams, toggleFollowTeam } from '../api/leagues';

export const useLeagues = (search?: string) => {
  return useQuery({
    queryKey: ['leagues', search],
    queryFn: () => getLeagues(search ? { search } : undefined),
  });
};

export const useCoreLeagues = () => {
  return useQuery({
    queryKey: ['leagues', 'core'],
    queryFn: () => getLeagues({ core_only: true }),
  });
};

export const useLeaguesByCountry = () => {
  return useQuery({
    queryKey: ['leagues', 'by-country'],
    queryFn: getLeaguesGroupedByCountry,
  });
};

export const useFollowedLeagues = () => {
  return useQuery({
    queryKey: ['leagues', 'followed'],
    queryFn: getFollowedLeagues,
  });
};

export const useFollowedTeams = () => {
  return useQuery({
    queryKey: ['teams', 'followed'],
    queryFn: getFollowedTeams,
  });
};

export const useToggleFollowLeague = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleFollowLeague,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
  });
};

export const useToggleFollowTeam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: toggleFollowTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['leagues'] });
    },
  });
};
