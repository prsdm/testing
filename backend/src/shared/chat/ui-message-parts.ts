import type { UIMessage } from "ai";
import { normalizeStoredToolPart } from "@/shared/chat/workflow-tool-parts";
import type { ChatMessagePart, MessageMetadata } from "@/shared/types";

export function uiPartToChatPart(part: unknown): ChatMessagePart | null {
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
  return null;
}

export function uiPartsToChatParts(
  parts: UIMessage["parts"]
): ChatMessagePart[] {
  return parts
    .map(uiPartToChatPart)
    .filter((part): part is ChatMessagePart => part !== null);
}

export function pendingToolApprovalFromParts(
  parts: ChatMessagePart[]
): MessageMetadata["pendingToolApproval"] {
  const pendingPart = parts.find(
    (part) =>
      part.type.startsWith("tool-") &&
      "state" in part &&
      part.state === "approval-requested"
  );
  return pendingPart ? pendingToolApprovalFromToolPart(pendingPart) : undefined;
}

export function pendingToolApprovalFromToolPart(
  part: ChatMessagePart
): MessageMetadata["pendingToolApproval"] | undefined {
  if (
    !part.type.startsWith("tool-") ||
    !("state" in part) ||
    part.state !== "approval-requested" ||
    !("toolCallId" in part)
  ) {
    return undefined;
  }
  return {
    approvalId:
      "approval" in part &&
      part.approval &&
      typeof part.approval.id === "string"
        ? part.approval.id
        : undefined,
    args:
      part.input && typeof part.input === "object" && !Array.isArray(part.input)
        ? (part.input as Record<string, unknown>)
        : undefined,
    toolCallId: part.toolCallId,
    toolName: part.type.slice("tool-".length),
  };
}
