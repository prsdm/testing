import type { ChatMessage } from "@/shared/types";

export function isSourceSearchToolType(type: string) {
  return type === "tool-sourceSearch" || type === "tool-knowledgeSearch";
}

export function isActivityPart(part: ChatMessage["parts"][number]) {
  if (part.type === "reasoning") {
    return true;
  }
  if (isSourceSearchToolType(part.type)) {
    return true;
  }
  if (part.type === "tool-webSearch" || part.type === "tool-openUrl") {
    return true;
  }
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return true;
  }
  return false;
}

export function hasAssistantActivityShell(parts: ChatMessage["parts"]) {
  return parts.some(isActivityPart);
}

export function getFirstActivityPartIndex(parts: ChatMessage["parts"]) {
  return parts.findIndex(isActivityPart);
}

export function getLastActivityPartIndex(parts: ChatMessage["parts"]) {
  return parts.reduce((last, part, index) => {
    if (isActivityPart(part)) {
      return index;
    }
    return last;
  }, -1);
}

function isToolApprovalPlaceholderText(text: string) {
  return /^Waiting for approval to run `/i.test(text.trim());
}

export function isApprovalPlaceholderText(text: string) {
  return isToolApprovalPlaceholderText(text);
}

/** Preamble text before tools — hidden from main bubble and activity panel. */
export function isActivityExecutionText({
  part,
  partIndex,
  messageParts,
  isMessageStreaming,
}: {
  part: ChatMessage["parts"][number];
  partIndex: number;
  messageParts: ChatMessage["parts"];
  isMessageStreaming: boolean;
}): boolean {
  if (part.type !== "text" || !part.text?.trim()) {
    return false;
  }

  if (isToolApprovalPlaceholderText(part.text)) {
    return true;
  }

  const lastActivityPartIndex = getLastActivityPartIndex(messageParts);

  // Claude often streams a short preamble before reasoning/tool parts arrive.
  // Keep it out of the main bubble until activity parts exist — but stream
  // direct text answers normally when no tools or reasoning are involved.
  if (isMessageStreaming && lastActivityPartIndex < 0) {
    return hasAssistantActivityShell(messageParts);
  }

  if (lastActivityPartIndex >= 0 && partIndex <= lastActivityPartIndex) {
    return true;
  }

  return false;
}

/** True when a text part is the final answer after tools/reasoning, not inter-step commentary. */
export function isFinalAnswerNarrativePart({
  partIndex,
  messageParts,
}: {
  partIndex: number;
  messageParts: ChatMessage["parts"];
}): boolean {
  return partIndex > getLastActivityPartIndex(messageParts);
}

export function hasAssistantAnswerText(
  parts: ChatMessage["parts"],
  isMessageStreaming: boolean
) {
  return parts.some((part, index) => {
    if (part.type !== "text" || !part.text?.trim()) {
      return false;
    }
    return !isActivityExecutionText({
      isMessageStreaming,
      messageParts: parts,
      part,
      partIndex: index,
    });
  });
}
