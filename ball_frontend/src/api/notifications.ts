import { apiClient } from './client';
import type { PostAuthor } from './feed';

// Matches notifications/models.py NOTIFICATION_TYPES (10 types).
export type NotificationType =
  | 'kickoff'
  | 'goal'
  | 'card'
  | 'substitution'
  | 'reply'
  | 'repost'
  | 'follow'
  | 'reaction'
  | 'winnie_alert'
  | 'community_post'
  | 'match_result'
  | 'mention';

export interface AppNotification {
  id: number;
  sender: PostAuthor | null;
  notification_type: NotificationType;
  title: string;
  body: string;
  match_id: number | null;
  post_id: number | null;
  community_id: number | null;
  is_read: boolean;
  created_at: string;
}

export const getNotifications = async (): Promise<AppNotification[]> => {
  const { data } = await apiClient.get<AppNotification[]>('/api/notifications/');
  return data;
};

export const getUnreadCount = async (): Promise<number> => {
  const { data } = await apiClient.get<{ unread_count: number }>('/api/notifications/unread/count/');
  return data.unread_count;
};

export const markNotificationRead = async (id: number): Promise<void> => {
  await apiClient.post(`/api/notifications/${id}/read/`, {});
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await apiClient.post('/api/notifications/read-all/', {});
};

export const registerExpoPushToken = async (
  token: string,
  deviceType?: 'ios' | 'android',
): Promise<void> => {
  await apiClient.post('/api/notifications/expo/register/', {
    token,
    device_type: deviceType,
  });
};
