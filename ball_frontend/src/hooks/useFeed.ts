import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFollowingFeed,
  getForYouFeed,
  getPost,
  getUserPosts,
  createPost,
  deletePost,
  repost,
  type CreatePostPayload,
} from '../api/feed';

export const feedKeys = {
  following: ['feed', 'following'] as const,
  forYou: ['feed', 'forYou'] as const,
  post: (id: number) => ['post', id] as const,
  userPosts: (username: string) => ['userPosts', username] as const,
};

// Both feeds are infinite: the queryFn follows each page's absolute `next` URL
// (cursor for Following, offset for For You), stopping when `next` is null.
export const useFollowingFeed = () =>
  useInfiniteQuery({
    queryKey: feedKeys.following,
    queryFn: ({ pageParam }) => getFollowingFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });

export const useForYouFeed = () =>
  useInfiniteQuery({
    queryKey: feedKeys.forYou,
    queryFn: ({ pageParam }) => getForYouFeed(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
  });

export const usePost = (postId: number, options?: { pollWhileProcessing?: boolean }) =>
  useQuery({
    queryKey: feedKeys.post(postId),
    queryFn: () => getPost(postId),
    enabled: !!postId,
    // Poll only while a video attachment is still transcoding (36.9). Stop once
    // media_state flips to 'ready' — low-frequency, no dedicated WS needed.
    refetchInterval: (query) =>
      options?.pollWhileProcessing && query.state.data?.media_state === 'processing'
        ? 4000
        : false,
  });

export const useUserPosts = (username: string) =>
  useQuery({
    queryKey: feedKeys.userPosts(username),
    queryFn: () => getUserPosts(username),
    enabled: !!username,
  });

export const useCreatePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePostPayload) => createPost(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedKeys.following });
      qc.invalidateQueries({ queryKey: feedKeys.forYou });
    },
  });
};

export const useDeletePost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) => deletePost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedKeys.following });
      qc.invalidateQueries({ queryKey: feedKeys.forYou });
    },
  });
};

export const useRepost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ originalId, content }: { originalId: number; content?: string }) =>
      repost(originalId, content ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: feedKeys.following });
      qc.invalidateQueries({ queryKey: feedKeys.forYou });
    },
  });
};
