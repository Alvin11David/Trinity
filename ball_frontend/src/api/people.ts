import { apiClient } from './client';
import type { PostAuthor } from './feed';

// ---------------------------------------------------------------------------
// Activity → People (users/views.py NewFollowersView + SuggestedPeopleView).
// New queries over existing data — no new backend models.
// ---------------------------------------------------------------------------

// New followers = people who follow you but you don't follow back (blocked users
// excluded server-side). Rendered with a Follow-Back action — Ball's Follow is
// one-way and instant, so there's no accept/reject.
export const getNewFollowers = async (): Promise<PostAuthor[]> => {
  const { data } = await apiClient.get<PostAuthor[]>('/api/users/activity/followers/');
  return data;
};

export type SuggestionReasonType = 'mutual_follows' | 'groups_in_common' | 'interaction';

export interface SuggestionReason {
  type: SuggestionReasonType;
  count: number;
}

export interface SuggestedPerson {
  user: PostAuthor;
  reasons: SuggestionReason[]; // priority-ordered; [0] is the primary chip
}

export const getSuggestedPeople = async (): Promise<SuggestedPerson[]> => {
  const { data } = await apiClient.get<SuggestedPerson[]>('/api/users/activity/suggestions/');
  return data;
};

// Human label for a reason chip.
export const reasonLabel = (r: SuggestionReason): string => {
  switch (r.type) {
    case 'mutual_follows':
      return r.count === 1 ? '1 mutual follow' : `${r.count} mutual follows`;
    case 'groups_in_common':
      return r.count === 1 ? 'In 1 group together' : `In ${r.count} groups together`;
    case 'interaction':
      return 'You interact often';
  }
};
