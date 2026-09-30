import {
  getLastActivityPartIndex,
  hasAssistantAnswerText,
  isApprovalPlaceholderText,
} from "@/shared/chat/activity-parts";
import { pendingToolApprovalFromParts } from "@/shared/chat/ui-message-parts";
import type { ChatMessagePart, MessageMetadata } from "@/shared/types";

export function stripBotMention(text: string, botUserId?: string | null) {
  const trimmed = text.trim();
  if (!botUserId) {
    return trimmed.replace(/<@[A-Z0-9]+>/gi, "").trim();
  }
  return trimmed
    .replace(new RegExp(`<@${botUserId}>`, "gi"), "")
    .replace(/<@[A-Z0-9]+>/gi, "")
    .trim();
}

export function extractAssistantReplyText(parts: ChatMessagePart[]) {
  const chunks: string[] = [];
  for (const [index, part] of parts.entries()) {
    if (part.type !== "text" || !part.text?.trim()) {
      continue;
    }
    if (isApprovalPlaceholderText(part.text)) {
      continue;
    }
    if (!hasAssistantAnswerText(parts, false)) {
      chunks.push(part.text.trim());
      continue;
    }
    if (index > getLastActivityPartIndex(parts)) {
      chunks.push(part.text.trim());
    }
  }
  const reply = chunks.join("\n\n").trim();
  if (reply) {
    return reply;
  }

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part.type === "reasoning" && part.text?.trim()) {
      return part.text.trim();
    }
  }

  return "";
}

export function extractLibraryFileIds(parts: ChatMessagePart[]) {
  const fileIds = new Set<string>();
  for (const part of parts) {
    if (part.type !== "tool-saveToLibrary") {
      continue;
    }
    if (
      !("output" in part) ||
      !part.output ||
      typeof part.output !== "object"
    ) {
      continue;
    }
    const output = part.output as { libraryFileId?: unknown };
    if (
      typeof output.libraryFileId === "string" &&
      output.libraryFileId.trim()
    ) {
      fileIds.add(output.libraryFileId.trim());
    }
  }
  return [...fileIds];
}

export function extractPendingApproval(
  parts: ChatMessagePart[],
  metadata?: MessageMetadata | null
) {
  return (
    metadata?.pendingToolApproval ?? pendingToolApprovalFromParts(parts) ?? null
  );
}
