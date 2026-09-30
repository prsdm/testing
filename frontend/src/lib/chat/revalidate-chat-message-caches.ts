import type { ChatMessage } from "@/shared/types";

export function chatMessagesCachePrefix(chatId: string): string {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`;
}

export function collectRoomThreadRootIds(messages: ChatMessage[]): string[] {
  const roots = new Set<string>();
  for (const message of messages) {
    if (message.threadRootMessageId) {
      roots.add(message.threadRootMessageId);
    }
  }
  for (const message of messages) {
    if (message.threadRootMessageId) {
      continue;
    }
    if (messages.some((other) => other.threadRootMessageId === message.id)) {
      roots.add(message.id);
    }
  }
  return [...roots];
}

type MutateKey = (key: string) => Promise<unknown>;

/** Revalidate main timeline and thread caches for a room chat. */
export async function revalidateChatMessageCaches(
  mutate: MutateKey,
  chatId: string,
  messagesForThreadRoots: ChatMessage[] = [],
  extraThreadRootIds: Iterable<string> = []
): Promise<void> {
  const prefix = chatMessagesCachePrefix(chatId);
  const threadRoots = new Set([
    ...collectRoomThreadRootIds(messagesForThreadRoots),
    ...extraThreadRootIds,
  ]);
  await mutate(prefix);
  for (const threadRootMessageId of threadRoots) {
    await mutate(`${prefix}&threadRootMessageId=${threadRootMessageId}`);
  }
}
