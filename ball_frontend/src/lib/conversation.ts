import { displayName } from '../components/feed/Avatar';
import type { Conversation } from '../api/chat';

// A direct conversation has no own name — the other participant is the name.
export function conversationTitle(conversation: Conversation, viewerId: number | undefined) {
  if (conversation.conversation_type === 'direct') {
    const other = conversation.participants.find((p) => p.id !== viewerId);
    return other ? displayName(other) : 'Direct message';
  }
  return conversation.name || 'Conversation';
}
