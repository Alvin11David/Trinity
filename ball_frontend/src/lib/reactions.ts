import type { ReactionType } from '../api/feed';

export interface ReactionMeta {
  type: ReactionType;
  emoji: string;
  label: string;
  color: string;
}

// The 4 backend reaction types (feed/models.py Reaction.REACTION_TYPES).
export const REACTIONS: ReactionMeta[] = [
  { type: 'goal', emoji: '⚽', label: 'Goal', color: '#1B9C5D' },
  { type: 'hot_take', emoji: '🔥', label: 'Hot Take', color: '#F5A623' },
  { type: 'smart', emoji: '🧠', label: 'Smart', color: '#4C9AFF' },
  { type: 'terrible', emoji: '💩', label: 'Terrible', color: '#E5484D' },
];

export const reactionByType = (t: ReactionType | null): ReactionMeta | undefined =>
  t ? REACTIONS.find((r) => r.type === t) : undefined;
