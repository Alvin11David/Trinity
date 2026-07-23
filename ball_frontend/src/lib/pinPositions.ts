import { storage } from './storage';

/**
 * Per-user, per-conversation local persistence of pinned-card positions.
 *
 * The backend deliberately never stores where the floating pin cards sit — it
 * only knows WHICH messages are pinned. Each user's drag arrangement lives
 * here (secure-store on native / localStorage on web via `storage`), keyed by
 * conversation, so it survives closing and reopening the chat.
 *
 * SecureStore keys must be [A-Za-z0-9._-], so the key uses an underscore.
 */
export interface PinPosition {
  x: number;
  y: number;
}

type PositionMap = Record<string, PinPosition>; // messageId -> position

const keyFor = (conversationId: number) => `pinpos_${conversationId}`;

export async function getPinPositions(conversationId: number): Promise<PositionMap> {
  try {
    const raw = await storage.getItem(keyFor(conversationId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function savePinPosition(
  conversationId: number,
  messageId: number,
  pos: PinPosition,
): Promise<void> {
  try {
    const map = await getPinPositions(conversationId);
    map[String(messageId)] = pos;
    await storage.setItem(keyFor(conversationId), JSON.stringify(map));
  } catch {
    /* best-effort — a failed position save just means the card reverts to its
       default slot next open, never a crash. */
  }
}
