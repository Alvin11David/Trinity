import { apiClient } from './client';
import type { PostAuthor } from './feed';

// ---------------------------------------------------------------------------
// Types — mirror communities/serializers.py exactly.
// ---------------------------------------------------------------------------

export type CommunityRole = 'moderator' | 'member';
export type CommunityPostType = 'text' | 'match_object' | 'poll' | 'winnie_insight';
export type VoteType = 'up' | 'down';

export interface Community {
  id: number;
  name: string;
  description: string;
  avatar: string | null;
  banner: string | null;
  is_official: boolean;
  members_count: number;
  is_member: boolean;
  user_role: CommunityRole | null;
  room_conversation_id: number | null; // companion channel's Conversation pk, or null
  created_at: string;
}

export interface CommunityMembership {
  id: number;
  user: PostAuthor;
  role: CommunityRole;
  joined_at: string;
}

export interface CommunityPost {
  id: number;
  community: number;
  author: PostAuthor;
  content: string;
  post_type: CommunityPostType;
  match_id: number | null;
  is_pinned: boolean;
  upvotes: number;
  downvotes: number;
  user_vote: VoteType | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Endpoints — /api/communities/ (communities/urls.py)
// ---------------------------------------------------------------------------

export const getCommunities = async (): Promise<Community[]> => {
  const { data } = await apiClient.get<Community[]>('/api/communities/');
  return data;
};

export const getCommunity = async (id: number): Promise<Community> => {
  const { data } = await apiClient.get<Community>(`/api/communities/${id}/`);
  return data;
};

export const createCommunity = async (payload: {
  name: string;
  description?: string;
  avatar?: string;
  banner?: string;
}): Promise<Community> => {
  const { data } = await apiClient.post<Community>('/api/communities/', payload);
  return data;
};

// Toggle: joins if not a member, leaves if already one.
export const toggleJoinCommunity = async (id: number): Promise<{ status: 'joined' | 'left' }> => {
  const { data } = await apiClient.post(`/api/communities/${id}/join/`);
  return data;
};

export const getMyCommunities = async (): Promise<Community[]> => {
  const { data } = await apiClient.get<Community[]>('/api/communities/my/');
  return data;
};

export const getCommunityPosts = async (communityId: number): Promise<CommunityPost[]> => {
  const { data } = await apiClient.get<CommunityPost[]>(`/api/communities/${communityId}/posts/`);
  return data;
};

export const createCommunityPost = async (
  communityId: number,
  payload: { content: string; post_type?: CommunityPostType; match_id?: number | null },
): Promise<CommunityPost> => {
  const { data } = await apiClient.post<CommunityPost>(
    `/api/communities/${communityId}/posts/`,
    payload,
  );
  return data;
};

export const deleteCommunityPost = async (communityId: number, postId: number): Promise<void> => {
  await apiClient.delete(`/api/communities/${communityId}/posts/${postId}/`);
};

export const voteCommunityPost = async (
  postId: number,
  voteType: VoteType,
): Promise<{ status: 'voted' | 'updated' | 'removed'; vote_type?: VoteType }> => {
  const { data } = await apiClient.post(`/api/communities/posts/${postId}/vote/`, {
    vote_type: voteType,
  });
  return data;
};

export const togglePinPost = async (postId: number): Promise<{ status: 'pinned' | 'unpinned' }> => {
  const { data } = await apiClient.post(`/api/communities/posts/${postId}/pin/`);
  return data;
};

export const getCommunityMembers = async (communityId: number): Promise<CommunityMembership[]> => {
  const { data } = await apiClient.get<CommunityMembership[]>(
    `/api/communities/${communityId}/members/`,
  );
  return data;
};

export const kickCommunityMember = async (communityId: number, userId: number): Promise<void> => {
  await apiClient.post(`/api/communities/${communityId}/members/${userId}/kick/`);
};

export const promoteCommunityMember = async (
  communityId: number,
  userId: number,
): Promise<void> => {
  await apiClient.post(`/api/communities/${communityId}/members/${userId}/promote/`);
};

// Moderator-only: enable the companion channel. Backfills current members.
export const createCommunityRoom = async (
  communityId: number,
): Promise<{ status: string; conversation_id: number; room_id: number }> => {
  const { data } = await apiClient.post(`/api/communities/${communityId}/room/create/`);
  return data;
};
