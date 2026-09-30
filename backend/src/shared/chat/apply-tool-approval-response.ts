import { isDeniedToolPart } from "@/shared/chat/merge-workflow-chat-messages";
import { pendingToolApprovalFromParts } from "@/shared/chat/ui-message-parts";
import type { ChatMessage, MessageMetadata } from "@/shared/types";

function resolveToolCallIdForApproval(
  message: ChatMessage,
  args: { approvalId: string; approved: boolean }
) {
  const pending = message.metadata?.pendingToolApproval;
  const approvalPart = message.parts.find(
    (part) =>
      "approval" in part &&
      part.approval?.id === args.approvalId &&
      "toolCallId" in part
  );

  if (pending?.approvalId === args.approvalId) {
    return pending.toolCallId;
  }

  if (approvalPart && "toolCallId" in approvalPart) {
    return approvalPart.toolCallId;
  }

  if (!args.approved && pending?.toolCallId) {
    return pending.toolCallId;
  }

  if (!args.approved) {
    const awaitingApproval = message.parts.find(
      (part) =>
        "toolCallId" in part &&
        "state" in part &&
        part.state === "approval-requested"
    );
    if (awaitingApproval && "toolCallId" in awaitingApproval) {
      return awaitingApproval.toolCallId;
    }
  }
}

export function applyToolApprovalResponseToMessages(
  messages: ChatMessage[],
  args: {
    approvalId: string;
    approved: boolean;
    reason?: string;
  }
): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") {
      return message;
    }

    const toolCallId = resolveToolCallIdForApproval(message, args);

    if (!toolCallId) {
      return message;
    }

    const reason = args.reason?.trim() || "Rejected by user";

    const nextParts = message.parts.map((part) => {
      if (!("toolCallId" in part) || part.toolCallId !== toolCallId) {
        return part;
      }

      if (args.approved) {
        return {
          ...part,
          approval: part.approval
            ? { ...part.approval, approved: true }
            : undefined,
          state: "approval-responded" as const,
        };
      }

      return {
        ...part,
        approval: part.approval
          ? { ...part.approval, approved: false, reason }
          : undefined,
        errorText: reason,
        output: {
          reason,
          type: "execution-denied",
        },
        state: "output-denied" as const,
      };
    });

    const nextPending = pendingToolApprovalFromParts(nextParts);
    const nextMetadata: MessageMetadata = {
      ...message.metadata,
      pendingToolApproval: nextPending,
      workflowRunStatus: nextPending ? "suspended" : "running",
    };

    return {
      ...message,
      metadata: nextMetadata,
      parts: nextParts,
    };
  });
}

export function messageHasInlineToolApproval(message: ChatMessage): boolean {
  return message.parts.some((part) => {
    if (!("state" in part) || part.state !== "approval-requested") {
      return false;
    }
    if (isDeniedToolPart(part)) {
      return false;
    }
    return (
      "approval" in part &&
      part.approval &&
      typeof part.approval.id === "string"
    );
  });
}

export function isToolApprovalBatchComplete(message: ChatMessage): boolean {
  return message.role === "assistant" && !messageHasInlineToolApproval(message);
}
