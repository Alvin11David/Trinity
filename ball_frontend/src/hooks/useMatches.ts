import { useQuery } from '@tanstack/react-query';
import { getMatchesByDate } from '../api/matches';

export const useMatchesByDate = (date: string, season: number) => {
  return useQuery({
    queryKey: ['matches', date, season],
    queryFn: () => getMatchesByDate(date, season),
    enabled: !!date,
  });
};
