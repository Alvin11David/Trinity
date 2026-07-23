import { apiClient } from './client';
import type { Post, PostAuthor, MatchCard } from './feed';

// Five tabs (CLAUDE.md 37.3). Post-based tabs return Post[]; People returns
// users; Matches returns match cards (MatchCardSerializer, no goal_scorers).
export type SearchTab = 'top' | 'latest' | 'people' | 'matches' | 'media';

export type MatchSearchCard = Omit<MatchCard, 'goal_scorers'>;

export interface SearchResponse {
  tab: SearchTab;
  query: string;
  results: Post[] | PostAuthor[] | MatchSearchCard[];
}

export const search = async (
  q: string,
  tab: SearchTab = 'top',
  limit = 50,
): Promise<SearchResponse> => {
  const { data } = await apiClient.get<SearchResponse>('/api/feed/search/', {
    params: { q, tab, limit },
  });
  return data;
};

// Cheap typeahead — pg_trgm username prefix + cached hashtag prefix (37.5).
// Empty query returns the top trending hashtags (doubles as the Trends surface).
export interface AutocompleteUser {
  id: number;
  username: string;
  avatar: string | null;
}
export interface TrendingHashtag {
  tag: string;
  count: number;
  score: number;
}
export interface AutocompleteResponse {
  query: string;
  users: AutocompleteUser[];
  hashtags: TrendingHashtag[];
}

export const autocomplete = async (q: string, limit = 8): Promise<AutocompleteResponse> => {
  const { data } = await apiClient.get<AutocompleteResponse>('/api/feed/autocomplete/', {
    params: { q, limit },
  });
  return data;
};

// Convenience: the Trends list is just autocomplete with an empty query.
export const getTrends = async (limit = 20): Promise<TrendingHashtag[]> => {
  const { hashtags } = await autocomplete('', limit);
  return hashtags;
};
