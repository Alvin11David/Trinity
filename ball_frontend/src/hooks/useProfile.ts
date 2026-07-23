import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getProfile,
  getProfilePosts,
  getProfileReplies,
  getProfileMedia,
  getProfileReposts,
  getBlockedAccounts,
  toggleFollow,
  blockUser,
  unblockUser,
  reportUser,
  updateProfile,
  pinPost,
  unpinPost,
  type UpdateProfilePayload,
  type ReportReason,
} from '../api/profile';
import { feedKeys } from './useFeed';

export const profileKeys = {
  detail: (username: string) => ['profile', username] as const,
  posts: (username: string) => ['profile', username, 'posts'] as const,
  replies: (username: string) => ['profile', username, 'replies'] as const,
  media: (username: string) => ['profile', username, 'media'] as const,
  reposts: (username: string) => ['profile', username, 'reposts'] as const,
  blocked: ['blocked-accounts'] as const,
};

export const useProfileDetail = (username: string) =>
  useQuery({
    queryKey: profileKeys.detail(username),
    queryFn: () => getProfile(username),
    enabled: !!username,
  });

export const useProfilePosts = (username: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: profileKeys.posts(username),
    queryFn: ({ pageParam }) => getProfilePosts(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: !!username && enabled,
  });

export const useProfileReplies = (username: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: profileKeys.replies(username),
    queryFn: ({ pageParam }) => getProfileReplies(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: !!username && enabled,
  });

export const useProfileMedia = (username: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: profileKeys.media(username),
    queryFn: ({ pageParam }) => getProfileMedia(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: !!username && enabled,
  });

export const useProfileReposts = (username: string, enabled = true) =>
  useInfiniteQuery({
    queryKey: profileKeys.reposts(username),
    queryFn: ({ pageParam }) => getProfileReposts(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next ?? undefined,
    enabled: !!username && enabled,
  });

export const useToggleFollow = (username: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => toggleFollow(username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.detail(username) });
      qc.invalidateQueries({ queryKey: feedKeys.following });
    },
  });
};

export const useBlockUser = (username: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => blockUser(username),
    onSuccess: () => {
      // Blocking touches the profile, both feeds (posts vanish), and search.
      qc.invalidateQueries({ queryKey: profileKeys.detail(username) });
      qc.invalidateQueries({ queryKey: feedKeys.following });
      qc.invalidateQueries({ queryKey: feedKeys.forYou });
    },
  });
};

export const useUnblockUser = (username: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unblockUser(username),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.detail(username) });
      qc.invalidateQueries({ queryKey: profileKeys.blocked });
    },
  });
};

// The Blocked Accounts list (Settings) + a per-row unblock keyed by username.
export const useBlockedAccounts = () =>
  useQuery({
    queryKey: profileKeys.blocked,
    queryFn: getBlockedAccounts,
  });

export const useUnblockAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (username: string) => unblockUser(username),
    onSuccess: (_data, username) => {
      qc.invalidateQueries({ queryKey: profileKeys.blocked });
      qc.invalidateQueries({ queryKey: profileKeys.detail(username) });
    },
  });
};

export const useReportUser = (username: string) =>
  useMutation({
    mutationFn: ({ reason, detail }: { reason: ReportReason; detail?: string }) =>
      reportUser(username, reason, detail ?? ''),
  });

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const usePinPost = (username: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId }: { postId: number | null }) =>
      postId == null ? unpinPost() : pinPost(postId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profileKeys.detail(username) });
    },
  });
};
