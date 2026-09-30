import { applyStreamingAssistantSnapshot } from "@/shared/chat/merge-workflow-chat-messages";
import { normalizeChatMessageParts } from "@/shared/chat/workflow-tool-parts";
import type { ChatMessagePart } from "@/shared/types";

function hasPendingToolApproval(parts: ChatMessagePart[]): boolean {
  return parts.some(
    (part) =>
      part.type.startsWith("tool-") &&
      "state" in part &&
      part.state === "approval-requested"
  );
}

/** Prefer client snapshot when DB has not caught up with a suspended stream yet. */
export function resolveAssistantPartsForApproval(args: {
  dbParts: ChatMessagePart[];
  clientParts?: ChatMessagePart[];
}): ChatMessagePart[] {
  const clientParts = args.clientParts?.length
    ? normalizeChatMessageParts(args.clientParts)
    : undefined;
  if (!clientParts?.length) {
    return normalizeChatMessageParts(args.dbParts);
  }

  const dbParts = normalizeChatMessageParts(args.dbParts);
  if (hasPendingToolApproval(dbParts)) {
    return applyStreamingAssistantSnapshot(dbParts, clientParts);
  }
  if (hasPendingToolApproval(clientParts)) {
    return clientParts;
  }
  return applyStreamingAssistantSnapshot(dbParts, clientParts);
}

export function isResolvableToolApprovalPart(part: ChatMessagePart): boolean {
  if (
    !part.type.startsWith("tool-") ||
    !("state" in part) ||
    !("approval" in part) ||
    !part.approval?.id
  ) {
    return false;
  }
  return (
    part.state === "approval-requested" ||
    part.state === "input-available" ||
    part.state === "input-streaming"
  );
}

export function isResolvedToolApprovalPart(part: ChatMessagePart): boolean {
  if (!part.type.startsWith("tool-") || !("state" in part)) {
    return false;
  }
  if (part.state === "output-denied") {
    return true;
  }
  if (part.state === "approval-responded") {
    return true;
  }
  if (part.state === "output-available" || part.state === "output-error") {
    return true;
  }
  return false;
}
