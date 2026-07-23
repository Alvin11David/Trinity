import { useQuery } from '@tanstack/react-query';
import { getCountries } from '../api/countries';

// Near-static reference data (world countries + flags) — safe to cache for
// the lifetime of the app session rather than refetching per screen.
export const useCountries = () => {
  return useQuery({
    queryKey: ['countries'],
    queryFn: getCountries,
    staleTime: Infinity,
  });
};
