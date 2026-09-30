import type { UIMessage } from "ai";
import {
  applyDbAssistantSnapshot,
  assistantPartsRichness,
  isDeniedToolPart,
  mergeAssistantMessageMetadata,
} from "@/shared/chat/merge-workflow-chat-messages";
import {
  normalizeChatMessageParts,
  normalizeStoredToolPart,
} from "@/shared/chat/workflow-tool-parts";
import type {
  ChatMessage,
  ChatMessagePart,
  MessageMetadata,
} from "@/shared/types";

export function isEmptyAssistantMessage(message: ChatMessage): boolean {
  if (message.role !== "assistant") {
    return false;
  }
  if (message.parts.length === 0) {
    return true;
  }
  return message.parts.every((part) => {
    if (part.type === "text") {
      return !part.text.trim();
    }
    if (part.type === "reasoning") {
      return !part.text.trim();
    }
    return false;
  });
}

/** Drop trailing empty assistant placeholders left by failed or cancelled streams. */
export function pruneTerminalEmptyAssistantMessages(
  messages: ChatMessage[]
): ChatMessage[] {
  const result = [...messages];
  while (result.length > 0) {
    const last = result.at(-1);
    if (last?.role !== "assistant" || !isEmptyAssistantMessage(last)) {
      break;
    }
    const status = last.metadata?.workflowRunStatus;
    if (
      status === "cancelled" ||
      status === "failed" ||
      status === "pending" ||
      status === undefined
    ) {
      result.pop();
      continue;
    }
    break;
  }
  return result;
}

function assistantContentKey(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text" || part.type === "reasoning")
    .map((part) => ("text" in part ? part.text.trim() : ""))
    .filter(Boolean)
    .join("\0");
}

function resolveDuplicateAssistantPair(
  first: ChatMessage,
  second: ChatMessage
): "keep-first" | "keep-second" | "keep-both" {
  if (isEmptyAssistantMessage(first) && !isEmptyAssistantMessage(second)) {
    return "keep-second";
  }

  const sharedRunId =
    first.metadata?.workflowRunId &&
    first.metadata.workflowRunId === second.metadata?.workflowRunId;
  if (sharedRunId) {
    const firstScore = assistantPartsRichness(first.parts);
    const secondScore = assistantPartsRichness(second.parts);
    return firstScore >= secondScore ? "keep-first" : "keep-second";
  }

  const firstKey = assistantContentKey(first);
  const secondKey = assistantContentKey(second);
  if (firstKey && firstKey === secondKey) {
    if (second.metadata?.workflowRunId && !first.metadata?.workflowRunId) {
      return "keep-second";
    }
    return assistantPartsRichness(second.parts) >
      assistantPartsRichness(first.parts)
      ? "keep-second"
      : "keep-first";
  }

  if (
    firstKey &&
    secondKey &&
    firstKey.length > secondKey.length &&
    firstKey.startsWith(secondKey) &&
    (first.metadata?.workflowRunStatus === "success" ||
      assistantPartsRichness(first.parts) >
        assistantPartsRichness(second.parts) + 2)
  ) {
    return "keep-first";
  }

  return "keep-both";
}

function removeCrossMessageDuplicateToolParts(
  messages: ChatMessage[]
): ChatMessage[] {
  const seenToolCallIds = new Set<string>();
  return messages.map((message) => {
    if (message.role !== "assistant") {
      return message;
    }
    const parts = message.parts.filter((part) => {
      if (!("toolCallId" in part) || typeof part.toolCallId !== "string") {
        return true;
      }
      if (seenToolCallIds.has(part.toolCallId)) {
        return false;
      }
      seenToolCallIds.add(part.toolCallId);
      return true;
    });
    return parts.length === message.parts.length
      ? message
      : { ...message, parts };
  });
}

/** Drop placeholder and duplicate assistant rows from stream/id mismatches. */
export function dedupeEmptyAssistantMessages(
  messages: ChatMessage[]
): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const next = messages[index + 1];
    if (message.role === "assistant" && next?.role === "assistant") {
      const resolution = resolveDuplicateAssistantPair(message, next);
      if (resolution === "keep-second") {
        continue;
      }
      result.push(message);
      if (resolution === "keep-first") {
        index += 1;
      }
      continue;
    }
    result.push(message);
  }
  return removeCrossMessageDuplicateToolParts(result);
}

function toLocalPart(part: unknown): ChatMessagePart | null {
  if (!part || typeof part !== "object") {
    return null;
  }
  const value = part as Record<string, unknown>;
  if (value.type === "text" && typeof value.text === "string") {
    return { text: value.text, type: "text" };
  }
  if (value.type === "reasoning" && typeof value.text === "string") {
    if (!value.text.trim()) {
      return null;
    }
    return {
      state: value.state === "streaming" ? "streaming" : "done",
      text: value.text,
      type: "reasoning",
    };
  }
  if (typeof value.type !== "string") {
    return null;
  }
  if (value.type === "dynamic-tool" && typeof value.toolName === "string") {
    return normalizeStoredToolPart({
      ...(value as unknown as ChatMessagePart),
      type: `tool-${value.toolName}`,
    } as ChatMessagePart);
  }
  if (value.type.startsWith("tool-")) {
    return normalizeStoredToolPart(value as ChatMessagePart);
  }
  return value as unknown as ChatMessagePart;
}

export function workflowMessageToChatMessage(message: UIMessage): ChatMessage {
  const existingMetadata =
    (message.metadata as MessageMetadata | undefined) ?? {};
  const parts = message.parts
    .map(toLocalPart)
    .filter((part): part is ChatMessagePart => part !== null);
  const hasDeniedTool = parts.some(isDeniedToolPart);
  const pendingPart = hasDeniedTool
    ? undefined
    : parts.find(
        (part) =>
          part.type.startsWith("tool-") &&
          "state" in part &&
          part.state === "approval-requested" &&
          !isDeniedToolPart(part)
      );
  const pendingToolApproval =
    pendingPart && "toolCallId" in pendingPart
      ? {
          approvalId: pendingPart.approval?.id,
          args:
            pendingPart.input &&
            typeof pendingPart.input === "object" &&
            !Array.isArray(pendingPart.input)
              ? (pendingPart.input as Record<string, unknown>)
              : undefined,
          toolCallId: pendingPart.toolCallId,
          toolName: pendingPart.type.slice("tool-".length),
        }
      : undefined;

  return {
    id: message.id,
    metadata: {
      ...existingMetadata,
      pendingToolApproval,
      workflowRunStatus: pendingToolApproval
        ? "suspended"
        : existingMetadata.workflowRunStatus,
    },
    parts,
    role: message.role,
  };
}

export function chatMessageToWorkflowMessage(message: ChatMessage): UIMessage {
  return {
    id: message.id,
    metadata: message.metadata,
    parts: message.parts as UIMessage["parts"],
    role: message.role,
  };
}

export function workflowMessagesToChatMessages(
  messages: UIMessage[]
): ChatMessage[] {
  return pruneTerminalEmptyAssistantMessages(
    dedupeEmptyAssistantMessages(
      messages.map((message) => {
        const chatMessage = workflowMessageToChatMessage(message);
        if (chatMessage.role !== "assistant") {
          return chatMessage;
        }
        return {
          ...chatMessage,
          parts: normalizeChatMessageParts(chatMessage.parts),
        };
      })
    )
  );
}

export function chatMessagesToWorkflowMessages(
  messages: ChatMessage[]
): UIMessage[] {
  return messages.map(chatMessageToWorkflowMessage);
}

function mergeAssistantPartsForHydration(
  local: ChatMessagePart[],
  server: ChatMessagePart[]
): ChatMessagePart[] {
  return applyDbAssistantSnapshot(local, server);
}

/** DB assistant parts are canonical after workflow finalization. */
export function mergeHydratedChatMessages(
  local: ChatMessage[],
  server: ChatMessage[]
): ChatMessage[] {
  const localById = new Map(local.map((message) => [message.id, message]));
  const serverById = new Map(server.map((message) => [message.id, message]));

  const mergeServerMessage = (serverMessage: ChatMessage) => {
    const localMessage = localById.get(serverMessage.id);
    if (
      localMessage?.role !== "assistant" ||
      serverMessage.role !== "assistant"
    ) {
      return {
        ...serverMessage,
        threadRootMessageId:
          serverMessage.threadRootMessageId ??
          localMessage?.threadRootMessageId ??
          null,
      };
    }

    return {
      ...serverMessage,
      metadata: mergeAssistantMessageMetadata(
        localMessage.metadata,
        serverMessage.metadata,
        mergeAssistantPartsForHydration(localMessage.parts, serverMessage.parts)
      ),
      parts: mergeAssistantPartsForHydration(
        localMessage.parts,
        serverMessage.parts
      ),
      threadRootMessageId:
        serverMessage.threadRootMessageId ??
        localMessage.threadRootMessageId ??
        null,
    };
  };

  const merged = local.map((localMessage) => {
    const serverMessage = serverById.get(localMessage.id);
    return serverMessage ? mergeServerMessage(serverMessage) : localMessage;
  });
  const localIds = new Set(localById.keys());
  for (const serverMessage of server) {
    if (!localIds.has(serverMessage.id)) {
      merged.push(mergeServerMessage(serverMessage));
    }
  }
  return merged;
}
