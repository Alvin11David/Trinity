import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getNewFollowers, getSuggestedPeople } from '../api/people';
import { toggleFollow } from '../api/profile';

export const peopleKeys = {
  followers: ['activity', 'followers'] as const,
  suggestions: ['activity', 'suggestions'] as const,
};

export const useNewFollowers = () =>
  useQuery({
    queryKey: peopleKeys.followers,
    queryFn: getNewFollowers,
  });

export const useSuggestedPeople = () =>
  useQuery({
    queryKey: peopleKeys.suggestions,
    queryFn: getSuggestedPeople,
  });

// Follow (back) from the People segment. Reuses the one-way, instant follow
// endpoint; on success the followed person drops out of both lists, so both are
// invalidated.
export const useFollowPerson = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => toggleFollow(username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: peopleKeys.followers });
      qc.invalidateQueries({ queryKey: peopleKeys.suggestions });
    },
  });
};
