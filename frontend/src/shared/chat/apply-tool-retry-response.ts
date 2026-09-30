import { parallelToolBatchBounds } from "@/shared/chat/parallel-tool-batch";
import { isToolTerminalForRetry } from "@/shared/chat/tool-retry-eligibility";
import type {
  ChatMessage,
  ChatMessagePart,
  MessageMetadata,
} from "@/shared/types";

export { parallelToolBatchBoundsForToolCall } from "@/shared/chat/parallel-tool-batch";

function trimPartsAfterToolCall(parts: ChatMessagePart[], toolCallId: string) {
  const toolIndex = parts.findIndex(
    (part) => "toolCallId" in part && part.toolCallId === toolCallId
  );
  if (toolIndex < 0) {
    return parts;
  }

  const { end } = parallelToolBatchBounds(parts, toolIndex);
  return parts.slice(0, end + 1);
}

export function applyToolRetryToMessages(
  messages: ChatMessage[],
  args: {
    assistantMessageId: string;
    toolCallId: string;
  }
): ChatMessage[] {
  return messages.map((message) => {
    if (
      message.id !== args.assistantMessageId ||
      message.role !== "assistant"
    ) {
      return message;
    }

    const toolPart = message.parts.find(
      (part) =>
        "toolCallId" in part &&
        part.toolCallId === args.toolCallId &&
        isToolTerminalForRetry(part)
    );
    if (!toolPart || !("toolCallId" in toolPart)) {
      return message;
    }

    const approvalId = toolPart.approval?.id ?? toolPart.toolCallId;
    const trimmedParts = trimPartsAfterToolCall(message.parts, args.toolCallId);

    const nextParts = trimmedParts.map((part) => {
      if (!("toolCallId" in part) || part.toolCallId !== args.toolCallId) {
        return part;
      }

      return {
        ...part,
        approval: { id: approvalId },
        errorText: undefined,
        output: undefined,
        state: "approval-requested" as const,
      };
    });

    const pendingToolApproval: MessageMetadata["pendingToolApproval"] = {
      approvalId,
      args:
        toolPart.input &&
        typeof toolPart.input === "object" &&
        !Array.isArray(toolPart.input)
          ? (toolPart.input as Record<string, unknown>)
          : undefined,
      toolCallId: toolPart.toolCallId,
      toolName: toolPart.type.slice("tool-".length),
    };

    return {
      ...message,
      metadata: {
        ...message.metadata,
        pendingToolApproval,
        workflowRunStatus: "suspended",
      },
      parts: nextParts,
    };
  });
}

/** Trim downstream parts and show the retried tool as in-flight before the API returns. */
export function applyOptimisticToolRerunStart(
  messages: ChatMessage[],
  args: {
    assistantMessageId: string;
    toolCallId: string;
  }
): ChatMessage[] {
  return messages.map((message) => {
    if (
      message.id !== args.assistantMessageId ||
      message.role !== "assistant"
    ) {
      return message;
    }

    const toolPart = message.parts.find(
      (part) =>
        "toolCallId" in part &&
        part.toolCallId === args.toolCallId &&
        isToolTerminalForRetry(part)
    );
    if (!toolPart || !("toolCallId" in toolPart)) {
      return message;
    }

    const trimmedParts = trimPartsAfterToolCall(message.parts, args.toolCallId);
    const nextParts = trimmedParts.map((part) => {
      if (!("toolCallId" in part) || part.toolCallId !== args.toolCallId) {
        return part;
      }

      return {
        ...part,
        approval: undefined,
        errorText: undefined,
        output: undefined,
        state: "input-available" as const,
      };
    });

    return {
      ...message,
      metadata: {
        ...message.metadata,
        pendingToolApproval: undefined,
        workflowRunStatus: "running",
      },
      parts: nextParts,
    };
  });
}

export function applyConnectorToolRerunToMessages(
  messages: ChatMessage[],
  args: {
    assistantMessageId: string;
    toolCallId: string;
    nextPart: ChatMessagePart;
  }
): ChatMessage[] {
  return messages.map((message) => {
    if (
      message.id !== args.assistantMessageId ||
      message.role !== "assistant"
    ) {
      return message;
    }

    const trimmedParts = trimPartsAfterToolCall(message.parts, args.toolCallId);
    const nextParts = trimmedParts.map((part) =>
      "toolCallId" in part && part.toolCallId === args.toolCallId
        ? args.nextPart
        : part
    );

    return {
      ...message,
      metadata: {
        ...message.metadata,
        pendingToolApproval: undefined,
        workflowRunStatus: "running",
      },
      parts: nextParts,
    };
  });
}
