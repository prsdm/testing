import { notifyChatUnreadForRoom } from "@/core/lib/chat/chat-unread-notify";

export type ChatRoomMessagesChangedEvent = {
  type: "messages.changed";
  chatId: string;
  threadRootMessageId?: string | null;
};

export type ChatRoomTypingChangedEvent = {
  type: "typing.changed";
  chatId: string;
  typists: Array<{
    userId: string;
    displayName: string;
    threadRootMessageId: string | null;
  }>;
};

export type ChatRoomReactionsChangedEvent = {
  type: "reactions.changed";
  chatId: string;
  messageId: string;
};

export type ChatRoomEvent =
  | ChatRoomMessagesChangedEvent
  | ChatRoomTypingChangedEvent
  | ChatRoomReactionsChangedEvent;

type RoomEntry = {
  listeners: Set<(event: ChatRoomEvent) => void>;
};

const rooms = new Map<string, RoomEntry>();

function getOrCreateRoom(chatId: string): RoomEntry {
  let entry = rooms.get(chatId);
  if (!entry) {
    entry = { listeners: new Set() };
    rooms.set(chatId, entry);
  }
  return entry;
}

export function subscribeChatRoom(
  chatId: string,
  listener: (event: ChatRoomEvent) => void
) {
  const entry = getOrCreateRoom(chatId);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      rooms.delete(chatId);
    }
  };
}

export function publishChatRoomEvent(chatId: string, event: ChatRoomEvent) {
  const entry = rooms.get(chatId);
  if (!entry) {
    return;
  }
  for (const listener of entry.listeners) {
    listener(event);
  }
}

export function notifyChatRoomMessagesChanged(args: {
  chatId: string;
  threadRootMessageId?: string | null;
}) {
  publishChatRoomEvent(args.chatId, {
    type: "messages.changed",
    chatId: args.chatId,
    threadRootMessageId: args.threadRootMessageId ?? null,
  });
  void notifyChatUnreadForRoom(args.chatId);
}

export function notifyChatRoomReactionsChanged(args: {
  chatId: string;
  messageId: string;
}) {
  publishChatRoomEvent(args.chatId, {
    type: "reactions.changed",
    chatId: args.chatId,
    messageId: args.messageId,
  });
}
