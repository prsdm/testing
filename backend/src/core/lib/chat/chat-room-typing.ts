import { publishChatRoomEvent } from "@/core/lib/chat/chat-room-bus";

export type ChatRoomTypist = {
  userId: string;
  displayName: string;
  threadRootMessageId: string | null;
};

const TYPING_TTL_MS = 5000;

type TypingEntry = ChatRoomTypist & {
  expiresAt: number;
};

const typingByChat = new Map<string, Map<string, TypingEntry>>();

function getChatTypingMap(chatId: string): Map<string, TypingEntry> {
  let map = typingByChat.get(chatId);
  if (!map) {
    map = new Map();
    typingByChat.set(chatId, map);
  }
  return map;
}

function pruneExpired(chatId: string) {
  const map = typingByChat.get(chatId);
  if (!map) {
    return;
  }
  const now = Date.now();
  for (const [userId, entry] of map) {
    if (entry.expiresAt <= now) {
      map.delete(userId);
    }
  }
  if (map.size === 0) {
    typingByChat.delete(chatId);
  }
}

function listTypists(chatId: string): ChatRoomTypist[] {
  pruneExpired(chatId);
  const map = typingByChat.get(chatId);
  if (!map) {
    return [];
  }
  return [...map.values()].map(
    ({ userId, displayName, threadRootMessageId }) => ({
      displayName,
      threadRootMessageId,
      userId,
    })
  );
}

function publishTypingChanged(chatId: string) {
  publishChatRoomEvent(chatId, {
    chatId,
    typists: listTypists(chatId),
    type: "typing.changed",
  });
}

export function setChatRoomTyping(args: {
  chatId: string;
  userId: string;
  displayName: string;
  threadRootMessageId?: string | null;
}) {
  const map = getChatTypingMap(args.chatId);
  map.set(args.userId, {
    displayName: args.displayName,
    expiresAt: Date.now() + TYPING_TTL_MS,
    threadRootMessageId: args.threadRootMessageId ?? null,
    userId: args.userId,
  });
  publishTypingChanged(args.chatId);
}

export function clearChatRoomTyping(args: { chatId: string; userId: string }) {
  const map = typingByChat.get(args.chatId);
  if (!map?.has(args.userId)) {
    return;
  }
  map.delete(args.userId);
  if (map.size === 0) {
    typingByChat.delete(args.chatId);
  }
  publishTypingChanged(args.chatId);
}

export function clearAllChatRoomTypingForUser(args: {
  chatId: string;
  userId: string;
}) {
  clearChatRoomTyping(args);
}
