import { sortChatMessagesChronologically } from "@/lib/chat/message-order";
import { isInProgressRoomAssistantPlaceholder } from "@/lib/chat/room-message-visibility";
import { isEmptyAssistantMessage } from "@/lib/chat/workflow-message-bridge";
import { mergeAssistantMessageMetadata } from "@/shared/chat/merge-workflow-chat-messages";
import type { ChatMessage } from "@/shared/types";
import { getTextFromMessage } from "@/shared/utils";

function messageBelongsToThread(
  message: ChatMessage,
  threadRootMessageId: string
): boolean {
  return (
    message.id === threadRootMessageId ||
    message.threadRootMessageId === threadRootMessageId
  );
}

function shouldPreferLiveAssistantParts(
  server: ChatMessage,
  live: ChatMessage
): boolean {
  if (live.role !== "assistant" || server.role !== "assistant") {
    return false;
  }
  if (isInProgressRoomAssistantPlaceholder(live)) {
    return true;
  }
  const liveStatus = live.metadata?.workflowRunStatus;
  const serverStatus = server.metadata?.workflowRunStatus;
  if (
    liveStatus === "running" ||
    liveStatus === "suspended" ||
    liveStatus === "pending"
  ) {
    return true;
  }
  if (serverStatus === "success" && liveStatus !== "success") {
    return false;
  }
  if (isEmptyAssistantMessage(server) && !isEmptyAssistantMessage(live)) {
    return true;
  }
  return (
    getTextFromMessage(live).trim().length >
    getTextFromMessage(server).trim().length
  );
}

/** Keep DB ordering metadata while streaming assistant parts stay live. */
export function mergeRoomThreadMessagePair(
  server: ChatMessage,
  live: ChatMessage
): ChatMessage {
  if (live.role !== "assistant" || server.role !== "assistant") {
    return {
      ...server,
      ...live,
      metadata: {
        ...server.metadata,
        ...live.metadata,
        createdAt: server.metadata?.createdAt ?? live.metadata?.createdAt,
      },
      threadRootMessageId:
        server.threadRootMessageId ?? live.threadRootMessageId ?? null,
    };
  }

  const parts = shouldPreferLiveAssistantParts(server, live)
    ? live.parts
    : server.parts;

  return {
    ...server,
    ...live,
    metadata: mergeAssistantMessageMetadata(
      server.metadata,
      live.metadata,
      parts
    ),
    parts,
    threadRootMessageId:
      server.threadRootMessageId ?? live.threadRootMessageId ?? null,
  };
}

export function mergeRoomThreadMessages(args: {
  liveMessages: ChatMessage[];
  serverMessages: ChatMessage[];
  threadRootMessageId: string;
}): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of args.serverMessages) {
    byId.set(message.id, message);
  }
  for (const message of args.liveMessages) {
    if (!messageBelongsToThread(message, args.threadRootMessageId)) {
      continue;
    }
    const serverMessage = byId.get(message.id);
    byId.set(
      message.id,
      serverMessage
        ? mergeRoomThreadMessagePair(serverMessage, message)
        : message
    );
  }
  return sortChatMessagesChronologically([...byId.values()], {
    threadRootMessageId: args.threadRootMessageId,
  });
}
