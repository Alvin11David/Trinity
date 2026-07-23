import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types — mirror the backend feed serializers (feed/serializers.py) exactly.
// ---------------------------------------------------------------------------

export interface PostAuthor {
  id: number;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  favorite_club?: string | null;
  bio?: string;
  avatar?: string | null;
  banner?: string | null;
  followers_count?: number;
  following_count?: number;
  created_at?: string;
}

export type PostType = 'text' | 'match_object' | 'winnie_insight' | 'poll';
export type MediaType = 'photo' | 'video';
export type MediaStatus = 'processing' | 'ready' | 'failed';
export type MediaState = 'ready' | 'processing';
export type ReactionType = 'goal' | 'hot_take' | 'smart' | 'terrible';

export interface PostMedia {
  id: number;
  media_type: MediaType;
  status: MediaStatus;
  order: number;
  url: string | null;
  width: number | null;
  height: number | null;
  mux_playback_id: string | null;
  thumbnail_url: string | null;
  duration: number | null;
}

export interface GoalScorer {
  team: string;
  player: string;
  minute: number;
  assist: string | null;
  detail: string;
}

// match_card is MatchCardSerializer output + goal_scorers (feed adds it for recaps)
export interface MatchCard {
  id: number;
  league: string | null;
  home_team: string;
  away_team: string;
  home_team_logo: string | null;
  away_team_logo: string | null;
  kickoff_time: string;
  status: string;
  minute: number | null;
  home_score: number | null;
  away_score: number | null;
  has_prediction: boolean;
  updated_at: string;
  goal_scorers: GoalScorer[];
}

export interface Post {
  id: number;
  author: PostAuthor;
  content: string;
  post_type: PostType;
  match_id: number | null;
  repost_of: number | null;
  reactions_count: number;
  reposts_count: number;
  comments_count: number;
  user_reaction: ReactionType | null;
  match_card: MatchCard | null;
  media: PostMedia[];
  media_state: MediaState;
  created_at: string;
  updated_at: string;
}

export interface CommentNode {
  id: number;
  post: number;
  author: PostAuthor;
  parent: number | null;
  content: string;
  created_at: string;
  replies: CommentNode[];
}

// ---------------------------------------------------------------------------
// Feeds — both paginated (Section 43). Following uses DRF CursorPagination
// (keyset on created_at,id); For You uses limit/offset over the recomputed
// ranked list. Both return this envelope with an absolute `next` URL, which
// the infinite-query hooks follow directly.
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  count?: number; // present for limit/offset (For You) only
  next: string | null;
  previous: string | null;
  results: T[];
}

// `pageUrl` is the absolute `next` URL from a prior page (undefined = first page).
export const getFollowingFeed = async (pageUrl?: string): Promise<Paginated<Post>> => {
  const { data } = await apiClient.get<Paginated<Post>>(pageUrl ?? '/api/feed/');
  return data;
};

export const getForYouFeed = async (pageUrl?: string): Promise<Paginated<Post>> => {
  const { data } = await apiClient.get<Paginated<Post>>(pageUrl ?? '/api/feed/global/');
  return data;
};

export const getPost = async (postId: number): Promise<Post> => {
  const { data } = await apiClient.get<Post>(`/api/feed/posts/${postId}/`);
  return data;
};

export const getUserPosts = async (username: string): Promise<Post[]> => {
  const { data } = await apiClient.get<Post[]>(`/api/feed/users/${username}/posts/`);
  return data;
};

export interface CreatePostPayload {
  content?: string;
  post_type?: PostType;
  match_id?: number | null;
  repost_of?: number | null;
}

// Response is PostCreateSerializer (thin: id/content/post_type/match_id/repost_of)
export interface CreatedPost {
  id: number;
  content: string;
  post_type: PostType;
  match_id: number | null;
  repost_of: number | null;
}

export const createPost = async (payload: CreatePostPayload): Promise<CreatedPost> => {
  const { data } = await apiClient.post<CreatedPost>('/api/feed/posts/', {
    post_type: 'text',
    ...payload,
  });
  return data;
};

export const deletePost = async (postId: number): Promise<void> => {
  await apiClient.delete(`/api/feed/posts/${postId}/`);
};

// Plain repost = repost_of set, empty content. Quote-repost = repost_of + content.
export const repost = async (originalId: number, content = ''): Promise<CreatedPost> =>
  createPost({ repost_of: originalId, content, post_type: 'text' });

// ---------------------------------------------------------------------------
// Reactions — 4 types, toggle semantics. Server returns the resulting state.
// ---------------------------------------------------------------------------

export interface ReactionResult {
  status: 'reacted' | 'removed' | 'updated';
  reaction_type?: ReactionType;
}

export const reactToPost = async (
  postId: number,
  reactionType: ReactionType,
): Promise<ReactionResult> => {
  const { data } = await apiClient.post<ReactionResult>(
    `/api/feed/posts/${postId}/react/`,
    { reaction_type: reactionType },
  );
  return data;
};

// ---------------------------------------------------------------------------
// Comments — GET returns a pre-nested tree (each node carries `replies`).
// ---------------------------------------------------------------------------

export const getComments = async (postId: number): Promise<CommentNode[]> => {
  const { data } = await apiClient.get<CommentNode[]>(`/api/feed/posts/${postId}/comments/`);
  return data;
};

export const addComment = async (
  postId: number,
  content: string,
  parent?: number | null,
): Promise<CommentNode> => {
  const { data } = await apiClient.post<CommentNode>(
    `/api/feed/posts/${postId}/comments/`,
    { content, parent: parent ?? null },
  );
  return data;
};

export const deleteComment = async (commentId: number): Promise<void> => {
  await apiClient.delete(`/api/feed/comments/${commentId}/`);
};
