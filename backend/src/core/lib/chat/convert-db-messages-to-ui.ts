import { formatISO } from "date-fns";
import type { DBMessage } from "@/core/lib/db/schema";
import { isDeniedToolPart } from "@/shared/chat/merge-workflow-chat-messages";
import { normalizeChatMessageParts } from "@/shared/chat/workflow-tool-parts";
import type {
  ChatMessage,
  ChatMessagePart,
  MessageMetadata,
} from "@/shared/types";
import { resolveAssistantAgentMetadata } from "./message-metadata";

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message, index, allMessages) => {
    const storedMetadata = (message.metadata ?? {}) as MessageMetadata;
    const metadata: MessageMetadata = {
      ...storedMetadata,
      // The database column is the canonical conversation order. Assistant
      // metadata may be updated when streaming finishes, which can be later
      // than a subsequent user message.
      createdAt: formatISO(message.createdAt),
    };

    if (message.role === "assistant") {
      const previousMessage = index > 0 ? allMessages[index - 1] : undefined;
      const previousUserMetadata =
        previousMessage?.role === "user"
          ? ((previousMessage.metadata ?? {}) as MessageMetadata)
          : undefined;

      Object.assign(
        metadata,
        resolveAssistantAgentMetadata({
          assistantMetadata: metadata,
          userMetadata: previousUserMetadata,
        })
      );
      if (!metadata.replyToMessageId && previousMessage?.role === "user") {
        metadata.replyToMessageId = previousMessage.id;
      }
    }

    return normalizeAssistantMessageFromDb({
      id: message.id,
      metadata,
      parts:
        message.role === "assistant"
          ? normalizeChatMessageParts(message.parts as ChatMessagePart[])
          : (message.parts as ChatMessagePart[]),
      role: message.role as "user" | "assistant" | "system",
      threadRootMessageId: message.threadRootMessageId ?? null,
    });
  });
}

function normalizeAssistantMessageFromDb(message: ChatMessage): ChatMessage {
  if (message.role !== "assistant") {
    return message;
  }

  if (!message.parts.some(isDeniedToolPart)) {
    return message;
  }

  return {
    ...message,
    metadata: {
      ...message.metadata,
      pendingToolApproval: undefined,
      workflowRunStatus:
        message.metadata?.workflowRunStatus === "suspended"
          ? "success"
          : message.metadata?.workflowRunStatus,
    },
  };
}
