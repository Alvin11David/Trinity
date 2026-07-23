import type { NotificationType } from '../api/notifications';

type IoniconName = React.ComponentProps<typeof import('@expo/vector-icons').Ionicons>['name'];

interface NotifMeta {
  icon: IoniconName;
  color: string;
}

// Distinct icon + accent per notification type (Step 7 — render each type
// distinctly, not a generic "X did something" line).
const META: Record<NotificationType, NotifMeta> = {
  goal: { icon: 'football', color: '#1B9C5D' },
  card: { icon: 'albums', color: '#F5A623' },
  substitution: { icon: 'swap-horizontal', color: '#4C9AFF' },
  match_result: { icon: 'time', color: '#A1A1A1' },
  kickoff: { icon: 'alarm', color: '#4C9AFF' },
  reply: { icon: 'chatbubble', color: '#4C9AFF' },
  repost: { icon: 'repeat', color: '#1B9C5D' },
  follow: { icon: 'person-add', color: '#1B9C5D' },
  reaction: { icon: 'happy', color: '#F5A623' },
  mention: { icon: 'at', color: '#4C9AFF' },
  winnie_alert: { icon: 'sparkles', color: '#1B9C5D' },
  community_post: { icon: 'people', color: '#4C9AFF' },
};

export const notificationMeta = (type: NotificationType): NotifMeta =>
  META[type] ?? { icon: 'notifications', color: '#A1A1A1' };
