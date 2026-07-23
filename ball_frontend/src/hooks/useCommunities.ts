import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCommunities,
  getCommunity,
  createCommunity,
  toggleJoinCommunity,
  getMyCommunities,
  getCommunityPosts,
  createCommunityPost,
  deleteCommunityPost,
  voteCommunityPost,
  togglePinPost,
  getCommunityMembers,
  kickCommunityMember,
  promoteCommunityMember,
  createCommunityRoom,
  type CommunityPostType,
  type VoteType,
} from '../api/communities';
import { chatKeys } from './useChat';

export const communityKeys = {
  all: ['communities', 'all'] as const,
  mine: ['communities', 'mine'] as const,
  detail: (id: number) => ['communities', 'detail', id] as const,
  posts: (id: number) => ['communities', 'posts', id] as const,
  members: (id: number) => ['communities', 'members', id] as const,
};

export const useCommunities = () =>
  useQuery({ queryKey: communityKeys.all, queryFn: getCommunities });

export const useMyCommunities = () =>
  useQuery({ queryKey: communityKeys.mine, queryFn: getMyCommunities });

export const useCommunity = (id: number) =>
  useQuery({
    queryKey: communityKeys.detail(id),
    queryFn: () => getCommunity(id),
    enabled: !!id,
  });

export const useCreateCommunity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCommunity,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.all });
      qc.invalidateQueries({ queryKey: communityKeys.mine });
    },
  });
};

export const useToggleJoinCommunity = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => toggleJoinCommunity(communityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.all });
      qc.invalidateQueries({ queryKey: communityKeys.mine });
      qc.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
      qc.invalidateQueries({ queryKey: communityKeys.members(communityId) });
      // Joining/leaving may sync membership onto a companion channel.
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
};

export const useCommunityPosts = (communityId: number) =>
  useQuery({
    queryKey: communityKeys.posts(communityId),
    queryFn: () => getCommunityPosts(communityId),
    enabled: !!communityId,
  });

export const useCreateCommunityPost = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content: string; post_type?: CommunityPostType; match_id?: number | null }) =>
      createCommunityPost(communityId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.posts(communityId) }),
  });
};

export const useDeleteCommunityPost = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => deleteCommunityPost(communityId, postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.posts(communityId) }),
  });
};

export const useVoteCommunityPost = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, voteType }: { postId: number; voteType: VoteType }) =>
      voteCommunityPost(postId, voteType),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.posts(communityId) }),
  });
};

export const useTogglePinPost = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => togglePinPost(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.posts(communityId) }),
  });
};

export const useCommunityMembers = (communityId: number, enabled = true) =>
  useQuery({
    queryKey: communityKeys.members(communityId),
    queryFn: () => getCommunityMembers(communityId),
    enabled: enabled && !!communityId,
  });

export const useKickCommunityMember = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => kickCommunityMember(communityId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.members(communityId) });
      qc.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
      // Community-moderator kicks cascade to the companion channel.
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
};

export const usePromoteCommunityMember = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => promoteCommunityMember(communityId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: communityKeys.members(communityId) }),
  });
};

export const useCreateCommunityRoom = (communityId: number) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => createCommunityRoom(communityId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communityKeys.detail(communityId) });
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
    },
  });
};
