import type { ChatMessage } from "@/shared/types";

function messageTimestampMs(message: ChatMessage): number | null {
  const raw = message.metadata?.createdAt;
  if (!raw) {
    return null;
  }
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export function sortChatMessagesChronologically(
  messages: ChatMessage[],
  options?: { threadRootMessageId?: string }
): ChatMessage[] {
  const rootId = options?.threadRootMessageId;
  const byId = new Map(messages.map((message) => [message.id, message]));
  const originalIndex = new Map(
    messages.map((message, index) => [message.id, index])
  );

  return [...messages].sort((a, b) => {
    if (rootId) {
      if (a.id === rootId && b.id !== rootId) {
        return -1;
      }
      if (b.id === rootId && a.id !== rootId) {
        return 1;
      }
    }

    const aAnchor =
      (a.metadata?.replyToMessageId
        ? byId.get(a.metadata.replyToMessageId)
        : undefined) ?? a;
    const bAnchor =
      (b.metadata?.replyToMessageId
        ? byId.get(b.metadata.replyToMessageId)
        : undefined) ?? b;

    if (aAnchor.id === bAnchor.id) {
      if (a.id === aAnchor.id && b.id !== bAnchor.id) {
        return -1;
      }
      if (b.id === bAnchor.id && a.id !== aAnchor.id) {
        return 1;
      }
    }

    const aMs = messageTimestampMs(aAnchor);
    const bMs = messageTimestampMs(bAnchor);
    if (aMs !== null && bMs !== null && aMs !== bMs) {
      return aMs - bMs;
    }
    if (aMs !== null && bMs === null) {
      return -1;
    }
    if (aMs === null && bMs !== null) {
      return 1;
    }

    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
  });
}
