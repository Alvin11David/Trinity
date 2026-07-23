import { apiClient } from './client';
import type { Post, PostAuthor, Paginated } from './feed';

// ---------------------------------------------------------------------------
// Profile aggregate (Step 4) — mirrors users/serializers.py::ProfileSerializer.
// Everything the header + action row needs in one call, including the viewer's
// relationship so the right button state renders with no second round-trip.
// ---------------------------------------------------------------------------

export interface ProfileDetail {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar: string | null;
  banner: string | null;
  bio: string;
  favorite_team_id: number | null;
  favorite_team_name: string;
  favorite_team_logo: string | null;
  favorite_league: number | null;
  favorite_league_name: string | null;
  favorite_league_logo: string | null;
  followers_count: number;
  following_count: number;
  is_self: boolean;
  is_following: boolean;
  is_followed_by: boolean;
  is_blocked: boolean;      // viewer has blocked this user
  is_blocked_by: boolean;   // this user has blocked the viewer
  pinned_post: Post | null;
  created_at: string;
}

// A reply row for the Replies tab — feed/serializers.py::ProfileReplySerializer.
export interface ProfileReply {
  id: number;
  post: number;
  post_author_username: string;
  post_content: string;
  author: PostAuthor;
  parent: number | null;
  content: string;
  created_at: string;
}

export const getProfile = async (username: string): Promise<ProfileDetail> => {
  const { data } = await apiClient.get<ProfileDetail>(`/api/users/${username}/profile/`);
  return data;
};

// --- Paginated tabs (cursor). `pageUrl` is the absolute `next` from a prior page. ---

export const getProfilePosts = async (username: string, pageUrl?: string): Promise<Paginated<Post>> => {
  const { data } = await apiClient.get<Paginated<Post>>(pageUrl ?? `/api/feed/users/${username}/tab/posts/`);
  return data;
};

export const getProfileReplies = async (username: string, pageUrl?: string): Promise<Paginated<ProfileReply>> => {
  const { data } = await apiClient.get<Paginated<ProfileReply>>(pageUrl ?? `/api/feed/users/${username}/tab/replies/`);
  return data;
};

export const getProfileMedia = async (username: string, pageUrl?: string): Promise<Paginated<Post>> => {
  const { data } = await apiClient.get<Paginated<Post>>(pageUrl ?? `/api/feed/users/${username}/tab/media/`);
  return data;
};

export const getProfileReposts = async (username: string, pageUrl?: string): Promise<Paginated<Post>> => {
  const { data } = await apiClient.get<Paginated<Post>>(pageUrl ?? `/api/feed/users/${username}/tab/reposts/`);
  return data;
};

// --- Relationship actions ---

export const toggleFollow = async (username: string): Promise<{ status: 'followed' | 'unfollowed' }> => {
  const { data } = await apiClient.post(`/api/users/${username}/follow/`, {});
  return data;
};

export const blockUser = async (username: string): Promise<void> => {
  await apiClient.post(`/api/users/${username}/block/`, {});
};

export const unblockUser = async (username: string): Promise<void> => {
  await apiClient.delete(`/api/users/${username}/block/`);
};

export type ReportReason = 'spam' | 'harassment' | 'impersonation' | 'other';

export const reportUser = async (
  username: string,
  reason: ReportReason,
  detail = '',
): Promise<void> => {
  await apiClient.post(`/api/users/${username}/report/`, { reason, detail });
};

// --- Own-profile edits (Step 6) ---

export interface UpdateProfilePayload {
  username?: string;
  bio?: string;
  avatar?: string | null;
  favorite_team_id?: number | null;
  favorite_team_name?: string;
  favorite_team_logo?: string | null;
  favorite_league?: number | null;
}

export const updateProfile = async (payload: UpdateProfilePayload) => {
  const { data } = await apiClient.patch('/api/users/me/', payload);
  return data;
};

export const pinPost = async (postId: number): Promise<void> => {
  await apiClient.post('/api/users/me/pin/', { post_id: postId });
};

export const unpinPost = async (): Promise<void> => {
  await apiClient.delete('/api/users/me/pin/');
};

// --- Blocked accounts (Step 2/3) ---

// The canonical review/unblock list. Returns UserSerializer rows (avatar,
// username, …). Unblock reuses unblockUser(username) above.
export const getBlockedAccounts = async (): Promise<PostAuthor[]> => {
  const { data } = await apiClient.get<PostAuthor[]>('/api/users/blocked/');
  return data;
};

// --- Avatar / banner upload (Step 4/5) — reuses the S3 presigned-PUT flow ---

export type ProfileImageKind = 'avatar' | 'banner';

export interface ProfileImageUploadCredential {
  kind: ProfileImageKind;
  upload_url: string;
  storage_key: string;
  content_type: string;
}

export const requestProfileImageUpload = async (
  kind: ProfileImageKind,
  contentType: string,
): Promise<ProfileImageUploadCredential> => {
  const { data } = await apiClient.post<ProfileImageUploadCredential>(
    '/api/users/me/image/upload-url/',
    { kind, content_type: contentType },
  );
  return data;
};

// Finalize → server resizes (avatar 400², banner 1500×500) and returns the
// updated user (avatar/banner now populated).
export const finalizeProfileImage = async (kind: ProfileImageKind, storageKey: string) => {
  const { data } = await apiClient.post('/api/users/me/image/finalize/', {
    kind,
    storage_key: storageKey,
  });
  return data;
};
