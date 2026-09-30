export type ChatInboxEvent = {
  type: "unread.changed";
  chatId: string;
};

type InboxEntry = {
  listeners: Set<(event: ChatInboxEvent) => void>;
};

const inboxes = new Map<string, InboxEntry>();

function getOrCreateInbox(authUserId: string): InboxEntry {
  let entry = inboxes.get(authUserId);
  if (!entry) {
    entry = { listeners: new Set() };
    inboxes.set(authUserId, entry);
  }
  return entry;
}

export function subscribeUserChatInbox(
  authUserId: string,
  listener: (event: ChatInboxEvent) => void
) {
  const entry = getOrCreateInbox(authUserId);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    if (entry.listeners.size === 0) {
      inboxes.delete(authUserId);
    }
  };
}

export function notifyUserChatInbox(authUserId: string, event: ChatInboxEvent) {
  const entry = inboxes.get(authUserId);
  if (!entry) {
    return;
  }
  for (const listener of entry.listeners) {
    listener(event);
  }
}
