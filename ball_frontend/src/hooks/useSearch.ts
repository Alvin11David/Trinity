import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { search, autocomplete, getTrends, type SearchTab } from '../api/search';

export const searchKeys = {
  results: (q: string, tab: SearchTab) => ['search', tab, q] as const,
  autocomplete: (q: string) => ['autocomplete', q] as const,
  trends: ['trends'] as const,
};

// Full ranked search — fired on submit / tab change, NOT on every keystroke.
export const useSearch = (q: string, tab: SearchTab) =>
  useQuery({
    queryKey: searchKeys.results(q, tab),
    queryFn: () => search(q, tab),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
  });

// Cheap typeahead — separate endpoint (37.5). Debounce the `q` at the call site.
export const useAutocomplete = (q: string) =>
  useQuery({
    queryKey: searchKeys.autocomplete(q),
    queryFn: () => autocomplete(q),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
  });

// Trends = top trending hashtags (autocomplete with empty query).
export const useTrends = () =>
  useQuery({ queryKey: searchKeys.trends, queryFn: () => getTrends() });
