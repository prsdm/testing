import type { ChatRunStatus } from "@/lib/chat/chat-helpers";
import {
  dedupeEmptyAssistantMessages,
  mergeHydratedChatMessages,
  pruneTerminalEmptyAssistantMessages,
} from "@/lib/chat/workflow-message-bridge";
import { applyToolApprovalResponseToMessages } from "@/shared/chat/apply-tool-approval-response";
import {
  applyOptimisticToolRerunStart,
  applyToolRetryToMessages,
} from "@/shared/chat/apply-tool-retry-response";
import {
  applyExecutedToolPartUpdates,
  applyStreamingAssistantSnapshot,
  mergeAssistantMessageMetadata,
} from "@/shared/chat/merge-workflow-chat-messages";
import type { ChatMessage } from "@/shared/types";

export type RegisteredChat = {
  messages: ChatMessage[];
  status: ChatRunStatus;
  version: number;
};

const EMPTY_REGISTERED_CHAT: RegisteredChat = {
  messages: [],
  status: "ready",
  version: 0,
};

/**
 * Module-level registry so chat state survives React remounts when navigating
 * away from the chat UI during an in-flight workflow run.
 */
const registry = new Map<string, RegisteredChat>();
const snapshotByChatId = new Map<string, RegisteredChat>();
const lastAccessByChatId = new Map<string, number>();
const registryListeners = new Set<() => void>();

const MAX_IDLE_REGISTRY_CHATS = 24;
const IDLE_REGISTRY_TTL_MS = 30 * 60 * 1000;

function notifyRegistryListeners() {
  for (const listener of registryListeners) {
    listener();
  }
}

function touchChat(chatId: string) {
  lastAccessByChatId.set(chatId, Date.now());
}

function publishSnapshot(chatId: string, chat: RegisteredChat) {
  snapshotByChatId.set(chatId, {
    messages: chat.messages,
    status: chat.status,
    version: chat.version,
  });
}

function isChatBusy(chat: RegisteredChat) {
  return chat.status === "streaming" || chat.status === "submitted";
}

export function evictIdleRegisteredChats(activeChatId?: string | null) {
  const now = Date.now();
  const removable: Array<{ id: string; accessedAt: number }> = [];

  for (const [id, chat] of registry) {
    if (id === activeChatId || isChatBusy(chat)) {
      continue;
    }
    const accessedAt = lastAccessByChatId.get(id) ?? 0;
    if (now - accessedAt >= IDLE_REGISTRY_TTL_MS) {
      registry.delete(id);
      snapshotByChatId.delete(id);
      lastAccessByChatId.delete(id);
      continue;
    }
    removable.push({ accessedAt, id });
  }

  if (registry.size <= MAX_IDLE_REGISTRY_CHATS) {
    notifyRegistryListeners();
    return;
  }

  removable.sort((a, b) => a.accessedAt - b.accessedAt);
  const overflow = registry.size - MAX_IDLE_REGISTRY_CHATS;
  for (let index = 0; index < overflow; index += 1) {
    const entry = removable[index];
    if (!entry) {
      break;
    }
    registry.delete(entry.id);
    snapshotByChatId.delete(entry.id);
    lastAccessByChatId.delete(entry.id);
  }

  notifyRegistryListeners();
}

export function getRegisteredChat(chatId: string): RegisteredChat | undefined {
  const existing = registry.get(chatId);
  if (existing) {
    touchChat(chatId);
  }
  return existing;
}

export function getOrCreateRegisteredChat(
  chatId: string,
  initialMessages: ChatMessage[] = []
): RegisteredChat {
  const existing = registry.get(chatId);
  if (existing) {
    touchChat(chatId);
    return existing;
  }

  evictIdleRegisteredChats(chatId);

  const chat: RegisteredChat = {
    messages: initialMessages,
    status: "ready",
    version: 0,
  };
  registry.set(chatId, chat);
  publishSnapshot(chatId, chat);
  touchChat(chatId);
  notifyRegistryListeners();
  return chat;
}

export function setRegisteredMessages(
  chatId: string,
  updater: ChatMessage[] | ((messages: ChatMessage[]) => ChatMessage[])
) {
  const chat = getOrCreateRegisteredChat(chatId);
  const next = typeof updater === "function" ? updater(chat.messages) : updater;
  if (next === chat.messages) {
    return;
  }
  chat.messages = next;
  chat.version += 1;
  publishSnapshot(chatId, chat);
  touchChat(chatId);
  notifyRegistryListeners();
}

export function setRegisteredStatus(chatId: string, status: ChatRunStatus) {
  const chat = getOrCreateRegisteredChat(chatId);
  if (chat.status === status) {
    return;
  }
  chat.status = status;
  chat.version += 1;
  publishSnapshot(chatId, chat);
  touchChat(chatId);
  notifyRegistryListeners();
}

function replaceMessageById(
  messages: ChatMessage[],
  nextMessage: ChatMessage
): ChatMessage[] {
  const index = messages.findIndex((message) => message.id === nextMessage.id);
  if (index < 0) {
    return [...messages, nextMessage];
  }
  if (messages[index] === nextMessage) {
    return messages;
  }
  const next = [...messages];
  next[index] = nextMessage;
  return next;
}

function preserveThreadRootOnSnapshot(
  incoming: ChatMessage,
  existing: ChatMessage | undefined
): ChatMessage {
  const threadRootMessageId =
    incoming.threadRootMessageId ?? existing?.threadRootMessageId ?? null;
  if (threadRootMessageId === incoming.threadRootMessageId) {
    return incoming;
  }
  return { ...incoming, threadRootMessageId };
}

/**
 * Apply changed workflow messages by stable message ID. Stream snapshots replace
 * assistant parts directly; only terminal local tool states are preserved.
 */
export function applyRegisteredWorkflowSnapshot(
  chatId: string,
  changedMessages: ChatMessage[],
  status: ChatRunStatus
) {
  const chat = getOrCreateRegisteredChat(chatId);
  let nextMessages = chat.messages;

  for (const incoming of changedMessages) {
    const existing = nextMessages.find((message) => message.id === incoming.id);
    const nextMessage =
      existing && incoming.role === "assistant"
        ? (() => {
            const parts = applyStreamingAssistantSnapshot(
              existing.parts,
              incoming.parts
            );
            return preserveThreadRootOnSnapshot(
              {
                ...incoming,
                metadata: mergeAssistantMessageMetadata(
                  existing.metadata,
                  incoming.metadata,
                  parts
                ),
                parts,
              },
              existing
            );
          })()
        : preserveThreadRootOnSnapshot(incoming, existing);
    nextMessages = replaceMessageById(nextMessages, nextMessage);
  }

  const messagesChanged = nextMessages !== chat.messages;
  const statusChanged = status !== chat.status;
  if (!(messagesChanged || statusChanged)) {
    return;
  }
  chat.messages = nextMessages;
  chat.status = status;
  chat.version += 1;
  publishSnapshot(chatId, chat);
  touchChat(chatId);
  notifyRegistryListeners();
}

export function appendRegisteredOptimisticMessage(
  chatId: string,
  message: ChatMessage
) {
  setRegisteredMessages(chatId, (messages) =>
    messages.some((item) => item.id === message.id)
      ? messages
      : [...messages, message]
  );
}

export function applyRegisteredToolRetry(
  chatId: string,
  args: {
    assistantMessageId: string;
    toolCallId: string;
  }
) {
  const chat = getOrCreateRegisteredChat(chatId);
  const target = chat.messages.find(
    (message) => message.id === args.assistantMessageId
  );
  if (!target) {
    return;
  }
  const nextTarget = applyToolRetryToMessages([target], args)[0];
  if (nextTarget) {
    setRegisteredMessages(chatId, (messages) =>
      replaceMessageById(messages, nextTarget)
    );
  }
}

export function applyRegisteredOptimisticToolRerunStart(
  chatId: string,
  args: {
    assistantMessageId: string;
    toolCallId: string;
  }
) {
  const chat = getOrCreateRegisteredChat(chatId);
  const target = chat.messages.find(
    (message) => message.id === args.assistantMessageId
  );
  if (!target) {
    return;
  }
  const nextTarget = applyOptimisticToolRerunStart([target], args)[0];
  if (nextTarget) {
    setRegisteredMessages(chatId, (messages) =>
      replaceMessageById(messages, nextTarget)
    );
  }
}

export function applyRegisteredExecutedToolSync(
  chatId: string,
  args: {
    assistantMessageId: string;
    toolParts: ChatMessage["parts"];
  }
) {
  setRegisteredMessages(chatId, (messages) =>
    messages.map((message) =>
      message.id === args.assistantMessageId
        ? {
            ...message,
            parts: applyExecutedToolPartUpdates(
              message.parts,
              args.toolParts as ChatMessage["parts"]
            ),
          }
        : message
    )
  );
}

export function applyRegisteredAssistantMessageUpdate(
  chatId: string,
  args: {
    assistantMessageId: string;
    parts: ChatMessage["parts"];
    metadata?: ChatMessage["metadata"];
  }
) {
  setRegisteredMessages(chatId, (messages) =>
    messages.map((message) =>
      message.id === args.assistantMessageId
        ? {
            ...message,
            metadata: {
              ...message.metadata,
              ...args.metadata,
            },
            parts: args.parts,
          }
        : message
    )
  );
}

export function applyRegisteredToolApproval(
  chatId: string,
  response: {
    approvalId: string;
    approved: boolean;
    reason?: string;
  }
) {
  const chat = getOrCreateRegisteredChat(chatId);
  const target = [...chat.messages]
    .reverse()
    .find(
      (message) =>
        message.role === "assistant" &&
        (message.metadata?.pendingToolApproval?.approvalId ===
          response.approvalId ||
          message.parts.some(
            (part) =>
              part.type.startsWith("tool-") &&
              "approval" in part &&
              part.approval?.id === response.approvalId
          ))
    );
  if (!target) {
    return;
  }
  const nextTarget = applyToolApprovalResponseToMessages([target], response)[0];
  if (nextTarget) {
    setRegisteredMessages(chatId, (messages) =>
      replaceMessageById(messages, nextTarget)
    );
  }
}

/**
 * Hydrate only from the registry version observed by the render that received
 * this server snapshot. A stream or optimistic update between render and the
 * effect makes the snapshot stale and rejects it without timestamp guesses.
 */
export function hydrateRegisteredMessages(args: {
  chatId: string;
  serverMessages: ChatMessage[];
  expectedVersion: number;
}): ChatMessage[] | null {
  const chat = getOrCreateRegisteredChat(args.chatId);
  if (
    chat.version !== args.expectedVersion ||
    isChatBusy(chat) ||
    args.serverMessages.length === 0
  ) {
    return null;
  }
  const hydrated = pruneTerminalEmptyAssistantMessages(
    dedupeEmptyAssistantMessages(
      mergeHydratedChatMessages(chat.messages, args.serverMessages)
    )
  );
  if (hydrated === chat.messages) {
    return chat.messages;
  }
  chat.messages = hydrated;
  chat.version += 1;
  publishSnapshot(args.chatId, chat);
  touchChat(args.chatId);
  notifyRegistryListeners();
  return hydrated;
}

export function listStreamingChatIds(): string[] {
  const ids: string[] = [];
  for (const [id, chat] of registry) {
    if (isChatBusy(chat)) {
      ids.push(id);
    }
  }
  return ids;
}

export function subscribeChatRegistry(onStoreChange: () => void) {
  registryListeners.add(onStoreChange);
  return () => {
    registryListeners.delete(onStoreChange);
  };
}

let streamingSnapshotKey = "";
let streamingSnapshot: Set<string> = new Set();

export function getStreamingChatIdsSnapshot(): Set<string> {
  const ids = listStreamingChatIds().sort();
  const key = ids.join(",");
  if (key === streamingSnapshotKey) {
    return streamingSnapshot;
  }
  streamingSnapshotKey = key;
  streamingSnapshot = new Set(ids);
  return streamingSnapshot;
}

/** Stable snapshot for useSyncExternalStore — same ref until data changes. */
export function getRegisteredChatSnapshot(chatId: string): RegisteredChat {
  return snapshotByChatId.get(chatId) ?? EMPTY_REGISTERED_CHAT;
}

export const SERVER_REGISTERED_CHAT_SNAPSHOT = EMPTY_REGISTERED_CHAT;
