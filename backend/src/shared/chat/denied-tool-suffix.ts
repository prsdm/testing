import {
  isUserRejectedApprovalPart,
  isWriteToolName,
} from "@/shared/ai/tool-approvals";
import { isFinalAnswerNarrativePart } from "@/shared/chat/activity-parts";
import { isConnectorToolExecutionDenied } from "@/shared/chat/connector-action-tools";
import type { ChatMessagePart } from "@/shared/types";

function isTerminalToolPart(part: ChatMessagePart): boolean {
  if (!part.type.startsWith("tool-") || !("state" in part)) {
    return false;
  }
  if (part.state === "output-denied" || part.state === "output-error") {
    return true;
  }
  if (
    part.state === "output-available" &&
    isWriteToolName(part.type.slice("tool-".length)) &&
    "output" in part &&
    part.output !== undefined
  ) {
    return true;
  }
  return isConnectorToolExecutionDenied(
    "output" in part ? part.output : undefined
  );
}

function findLastTerminalToolIndex(parts: ChatMessagePart[]): number {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part && isTerminalToolPart(part)) {
      return index;
    }
  }
  return -1;
}

function isDeniedTerminalToolPart(part: ChatMessagePart): boolean {
  if (!part.type.startsWith("tool-") || !("state" in part)) {
    return false;
  }
  if (part.state === "output-denied" || part.state === "output-error") {
    return true;
  }
  return isConnectorToolExecutionDenied(
    "output" in part ? part.output : undefined
  );
}

/** True when a user-rejected approval still needs a skip-and-continue response. */
export function assistantTurnAwaitingPostUserRejectionContinuation(
  parts: ChatMessagePart[]
): boolean {
  if (!assistantTurnAwaitingPostDenialContinuation(parts)) {
    return false;
  }
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part?.type.startsWith("tool-") || !("state" in part)) {
      continue;
    }
    const toolName = part.type.slice("tool-".length);
    if (
      part.state === "output-available" &&
      isWriteToolName(toolName) &&
      !isConnectorToolExecutionDenied(
        "output" in part ? part.output : undefined
      )
    ) {
      return false;
    }
    if (isUserRejectedApprovalPart(part)) {
      return true;
    }
    if (part.state === "output-denied" || part.state === "output-error") {
      return false;
    }
  }
  return false;
}

/** True when a rejected tool still needs a follow-up assistant answer. */
export function assistantTurnAwaitingPostDenialContinuation(
  parts: ChatMessagePart[]
): boolean {
  let lastDeniedIndex = -1;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part && isDeniedTerminalToolPart(part)) {
      lastDeniedIndex = index;
      break;
    }
  }
  if (lastDeniedIndex < 0) {
    return false;
  }

  return !parts.some((part, index) => {
    if (
      index <= lastDeniedIndex ||
      part.type !== "text" ||
      !part.text?.trim()
    ) {
      return false;
    }
    return isFinalAnswerNarrativePart({
      messageParts: parts,
      partIndex: index,
    });
  });
}

function coalesceSuffixTextSnapshots(
  parts: ChatMessagePart[],
  terminalIndex: number
): ChatMessagePart[] {
  if (terminalIndex < 0) {
    return parts;
  }
  const result = [...parts];
  const snapshots: Array<{ index: number; text: string }> = [];
  const remove = new Set<number>();
  for (let index = terminalIndex + 1; index < result.length; index += 1) {
    const part = result[index];
    if (part?.type !== "text" || !part.text?.trim()) {
      continue;
    }
    const text = part.text.trim();
    const related = snapshots.find(
      (snapshot) =>
        snapshot.text.startsWith(text) || text.startsWith(snapshot.text)
    );
    if (!related) {
      snapshots.push({ index, text });
      continue;
    }
    if (text.length > related.text.length) {
      result[related.index] = part;
      related.text = text;
    }
    remove.add(index);
  }
  return result.filter((_, index) => !remove.has(index));
}

export function mergeSuffixAfterTerminalTool(
  local: ChatMessagePart[],
  merged: ChatMessagePart[]
): ChatMessagePart[] {
  const localTerminalIndex = findLastTerminalToolIndex(local);
  if (localTerminalIndex < 0) {
    return coalesceSuffixTextSnapshots(
      merged,
      findLastTerminalToolIndex(merged)
    );
  }
  const localTerminal = local[localTerminalIndex];
  const toolCallId =
    localTerminal && "toolCallId" in localTerminal
      ? localTerminal.toolCallId
      : undefined;
  const mergedTerminalIndex = toolCallId
    ? merged.findIndex(
        (part) => "toolCallId" in part && part.toolCallId === toolCallId
      )
    : findLastTerminalToolIndex(merged);
  if (mergedTerminalIndex < 0) {
    return merged;
  }

  const result = [...merged];
  let insertAt = result.findIndex(
    (part, index) => index > mergedTerminalIndex && part.type === "text"
  );
  if (insertAt < 0) {
    insertAt = result.length;
  }

  const localTexts = local
    .slice(localTerminalIndex + 1)
    .filter(
      (part): part is ChatMessagePart & { type: "text"; text: string } =>
        part.type === "text" && Boolean(part.text?.trim())
    );
  for (const part of localTexts) {
    const text = part.text.trim();
    const exactExists = result.some(
      (candidate) =>
        candidate.type === "text" && candidate.text?.trim() === text
    );
    if (exactExists) {
      continue;
    }
    const relatedIndex = result.findIndex(
      (candidate, index) =>
        index > mergedTerminalIndex &&
        candidate.type === "text" &&
        Boolean(candidate.text?.trim()) &&
        (candidate.text.trim().startsWith(text) ||
          text.startsWith(candidate.text.trim()))
    );
    if (relatedIndex >= 0) {
      const related = result[relatedIndex];
      if (
        related?.type === "text" &&
        text.length > related.text.trim().length
      ) {
        result[relatedIndex] = part;
      }
      continue;
    }
    result.splice(insertAt, 0, part);
    insertAt += 1;
  }

  return coalesceSuffixTextSnapshots(result, mergedTerminalIndex);
}

export function coalescePostTerminalSuffixTexts(
  parts: ChatMessagePart[]
): ChatMessagePart[] {
  return mergeSuffixAfterTerminalTool(parts, parts);
}
