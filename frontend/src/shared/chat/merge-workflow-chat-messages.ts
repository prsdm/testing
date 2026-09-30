import { isConnectorToolExecutionDenied } from "@/shared/chat/connector-action-tools";
import {
  assistantTurnAwaitingPostDenialContinuation,
  mergeSuffixAfterTerminalTool,
} from "@/shared/chat/denied-tool-suffix";
import { reasoningComparisonKey } from "@/shared/chat/thinking-text";
import { normalizeChatMessageParts } from "@/shared/chat/workflow-tool-parts";
import type {
  ChatMessage,
  ChatMessagePart,
  MessageMetadata,
} from "@/shared/types";

export function isDeniedToolPart(part: ChatMessagePart): boolean {
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

export function assistantPartsRichness(parts: ChatMessagePart[]): number {
  let score = 0;
  for (const part of parts) {
    if (part.type === "reasoning" && part.text?.trim()) {
      score += 2;
    }
    if (part.type.startsWith("tool-") && "state" in part) {
      if (isDeniedToolPart(part)) {
        score += 6;
      } else if (part.state === "output-available") {
        score += 5;
      } else if (part.state === "approval-requested") {
        score += 1;
      } else if (part.state === "input-available") {
        score += 1;
      }
    }
    if (part.type === "text" && part.text?.trim()) {
      score += 1;
    }
  }
  return score;
}

function mergeToolPart(
  existing: ChatMessagePart | undefined,
  incoming: ChatMessagePart
): ChatMessagePart {
  if (
    !existing ||
    !("toolCallId" in existing) ||
    !("toolCallId" in incoming) ||
    !("state" in existing) ||
    !("state" in incoming)
  ) {
    return incoming;
  }

  if (isDeniedToolPart(existing)) {
    return existing;
  }

  if (isDeniedToolPart(incoming)) {
    return incoming;
  }

  const rank = (part: ChatMessagePart) => {
    const state = "state" in part ? part.state : undefined;
    switch (state) {
      case "output-denied":
      case "output-error":
        return 5;
      case "output-available":
        return "output" in part && part.output !== undefined ? 4 : 2;
      case "approval-requested":
      case "approval-responded":
        return 3;
      case "input-streaming":
        return 2;
      case "input-available":
        return 1;
      default:
        return 0;
    }
  };

  const completionScore = (part: ChatMessagePart) => {
    if (
      "state" in part &&
      part.state === "output-available" &&
      "output" in part &&
      part.output !== undefined
    ) {
      return 2;
    }
    if ("state" in part && part.state === "approval-responded") {
      return 1;
    }
    return 0;
  };

  const existingRank = rank(existing);
  const incomingRank = rank(incoming);
  let selected: ChatMessagePart;
  if (incomingRank > existingRank) {
    selected = incoming;
  } else if (existingRank > incomingRank) {
    selected = existing;
  } else {
    selected =
      completionScore(incoming) >= completionScore(existing)
        ? incoming
        : existing;
  }
  const incomingInput = "input" in incoming ? incoming.input : undefined;
  const incomingInputIsEmpty =
    incomingInput === undefined ||
    incomingInput === null ||
    (typeof incomingInput === "object" &&
      !Array.isArray(incomingInput) &&
      Object.keys(incomingInput).length === 0);
  if (
    selected === incoming &&
    incomingInputIsEmpty &&
    "input" in existing &&
    existing.input !== undefined
  ) {
    return {
      ...incoming,
      input: existing.input,
    } as ChatMessagePart;
  }
  return selected;
}

export function applyExecutedToolPartUpdates(
  parts: ChatMessagePart[],
  updates: ChatMessagePart[]
): ChatMessagePart[] {
  const updatesById = new Map(
    updates
      .filter(
        (part): part is ChatMessagePart & { toolCallId: string } =>
          "toolCallId" in part
      )
      .map((part) => [part.toolCallId, part] as const)
  );

  return parts.map((part) => {
    if (!("toolCallId" in part)) {
      return part;
    }
    const update = updatesById.get(part.toolCallId);
    return update ? mergeToolPart(part, update) : part;
  });
}

function preserveLocalReasoningParts(
  local: ChatMessagePart[],
  merged: ChatMessagePart[]
): ChatMessagePart[] {
  const result = [...merged];
  const reasoningAnchor = (parts: ChatMessagePart[], index: number) => {
    const nextTool = parts
      .slice(index + 1)
      .find((candidate) => "toolCallId" in candidate);
    if (nextTool && "toolCallId" in nextTool) {
      return `before-tool:${nextTool.toolCallId}`;
    }
    const previousTool = parts
      .slice(0, index)
      .reverse()
      .find((candidate) => "toolCallId" in candidate);
    if (previousTool && "toolCallId" in previousTool) {
      return `after-tool:${previousTool.toolCallId}`;
    }
    const nextText = parts
      .slice(index + 1)
      .find((candidate) => candidate.type === "text");
    if (nextText?.type === "text") {
      return `text:${reasoningComparisonKey(nextText.text ?? "")}`;
    }
    return "end";
  };

  for (const [localIndex, part] of local.entries()) {
    if (part.type !== "reasoning" || !part.text?.trim()) {
      continue;
    }
    const text = part.text.trim();
    const anchor = reasoningAnchor(local, localIndex);
    const localKey = reasoningComparisonKey(text);
    const growingSnapshotIndex = result.findIndex((candidate) => {
      if (candidate.type !== "reasoning" || !candidate.text?.trim()) {
        return false;
      }
      const candidateKey = reasoningComparisonKey(candidate.text);
      const eitherIsStreaming =
        part.state === "streaming" || candidate.state === "streaming";
      return (
        eitherIsStreaming &&
        (candidateKey.startsWith(localKey) || localKey.startsWith(candidateKey))
      );
    });
    if (growingSnapshotIndex >= 0) {
      const candidate = result[growingSnapshotIndex];
      if (
        candidate?.type === "reasoning" &&
        candidate.text.trim().length < text.length
      ) {
        result[growingSnapshotIndex] = part;
      }
      continue;
    }
    const hasLongerLocalSnapshot = local.some((candidate, candidateIndex) => {
      if (
        candidateIndex === localIndex ||
        candidate.type !== "reasoning" ||
        !candidate.text?.trim() ||
        reasoningAnchor(local, candidateIndex) !== anchor
      ) {
        return false;
      }
      return candidate.text.trim().length > text.length;
    });
    if (hasLongerLocalSnapshot) {
      continue;
    }

    const existingReasoningIndex = result.findIndex(
      (candidate, candidateIndex) =>
        candidate.type === "reasoning" &&
        Boolean(candidate.text?.trim()) &&
        reasoningAnchor(result, candidateIndex) === anchor
    );
    if (existingReasoningIndex >= 0) {
      const existingReasoning = result[existingReasoningIndex];
      const localIsStreaming = "state" in part && part.state === "streaming";
      const incomingIsStreaming =
        existingReasoning &&
        "state" in existingReasoning &&
        existingReasoning.state === "streaming";
      result[existingReasoningIndex] =
        (localIsStreaming || incomingIsStreaming) &&
        existingReasoning?.type === "reasoning" &&
        existingReasoning.text.trim().length > part.text.trim().length
          ? existingReasoning
          : part;
      continue;
    }

    const findMatchingIndex = (candidate: ChatMessagePart) => {
      if ("toolCallId" in candidate) {
        return result.findIndex(
          (item) =>
            "toolCallId" in item && item.toolCallId === candidate.toolCallId
        );
      }
      if (candidate.type === "text" && candidate.text?.trim()) {
        return result.findIndex(
          (item) =>
            item.type === "text" && item.text?.trim() === candidate.text.trim()
        );
      }
      return -1;
    };
    const nextAnchor = local
      .slice(localIndex + 1)
      .find((candidate) => findMatchingIndex(candidate) >= 0);
    const previousTool = local
      .slice(0, localIndex)
      .reverse()
      .find((candidate) => "toolCallId" in candidate);
    let insertAt = Math.min(localIndex, result.length);

    if (nextAnchor) {
      const nextAnchorIndex = findMatchingIndex(nextAnchor);
      if (nextAnchorIndex >= 0) {
        insertAt = nextAnchorIndex;
      }
    } else if (previousTool && "toolCallId" in previousTool) {
      const previousToolIndex = result.findIndex(
        (candidate) =>
          "toolCallId" in candidate &&
          candidate.toolCallId === previousTool.toolCallId
      );
      if (previousToolIndex >= 0) {
        insertAt = previousToolIndex + 1;
        while (result[insertAt]?.type === "reasoning") {
          insertAt += 1;
        }
      }
    }

    result.splice(insertAt, 0, part);
  }
  return result;
}

function textToolAnchor(parts: ChatMessagePart[], index: number) {
  const previousTool = parts
    .slice(0, index)
    .reverse()
    .find((part) => "toolCallId" in part);
  const nextTool = parts.slice(index + 1).find((part) => "toolCallId" in part);
  return {
    next:
      nextTool && "toolCallId" in nextTool ? nextTool.toolCallId : undefined,
    previous:
      previousTool && "toolCallId" in previousTool
        ? previousTool.toolCallId
        : undefined,
  };
}

function preserveLocalTextParts(
  local: ChatMessagePart[],
  merged: ChatMessagePart[]
): ChatMessagePart[] {
  const result = [...merged];
  for (const [localIndex, part] of local.entries()) {
    if (part.type !== "text" || !part.text?.trim()) {
      continue;
    }
    const localText = part.text.trim();
    const anchor = textToolAnchor(local, localIndex);
    const anchoredTextIndices = result.flatMap((candidate, candidateIndex) => {
      if (candidate.type !== "text" || !candidate.text?.trim()) {
        return [];
      }
      const candidateAnchor = textToolAnchor(result, candidateIndex);
      return candidateAnchor.previous === anchor.previous &&
        candidateAnchor.next === anchor.next
        ? [candidateIndex]
        : [];
    });

    if (anchoredTextIndices.length > 0) {
      const candidateIndex = anchoredTextIndices[0];
      if (candidateIndex === undefined) {
        continue;
      }
      const candidate = result[candidateIndex];
      if (candidate?.type !== "text") {
        continue;
      }
      const candidateText = candidate.text.trim();
      if (localText.startsWith(candidateText)) {
        result[candidateIndex] = part;
      }
      continue;
    }

    if (
      result.some(
        (candidate) =>
          candidate.type === "text" && candidate.text?.trim() === localText
      )
    ) {
      continue;
    }

    const nextToolIndex = anchor.next
      ? result.findIndex(
          (candidate) =>
            "toolCallId" in candidate && candidate.toolCallId === anchor.next
        )
      : -1;
    result.splice(nextToolIndex >= 0 ? nextToolIndex : result.length, 0, part);
  }
  return result;
}

function preserveLocalOnlyToolParts(
  local: ChatMessagePart[],
  merged: ChatMessagePart[]
): ChatMessagePart[] {
  const result = [...merged];
  const mergedToolIds = new Set(
    result
      .filter(
        (part): part is ChatMessagePart & { toolCallId: string } =>
          "toolCallId" in part
      )
      .map((part) => part.toolCallId)
  );

  for (const [localIndex, part] of local.entries()) {
    if (!("toolCallId" in part) || mergedToolIds.has(part.toolCallId)) {
      continue;
    }
    if (!("state" in part)) {
      continue;
    }
    const preserveStates = new Set([
      "approval-requested",
      "approval-responded",
      "input-streaming",
      "input-available",
    ]);
    if (!preserveStates.has(part.state)) {
      continue;
    }

    const findMatchingIndex = (candidate: ChatMessagePart) => {
      if ("toolCallId" in candidate) {
        return result.findIndex(
          (item) =>
            "toolCallId" in item && item.toolCallId === candidate.toolCallId
        );
      }
      if (candidate.type === "text" && candidate.text?.trim()) {
        return result.findIndex(
          (item) =>
            item.type === "text" && item.text?.trim() === candidate.text.trim()
        );
      }
      return -1;
    };

    const nextAnchor = local
      .slice(localIndex + 1)
      .find((candidate) => findMatchingIndex(candidate) >= 0);
    const previousTool = local
      .slice(0, localIndex)
      .reverse()
      .find((candidate) => "toolCallId" in candidate);

    let insertAt = result.length;
    if (nextAnchor) {
      const nextAnchorIndex = findMatchingIndex(nextAnchor);
      if (nextAnchorIndex >= 0) {
        insertAt = nextAnchorIndex;
      }
    } else if (previousTool && "toolCallId" in previousTool) {
      const previousToolIndex = result.findIndex(
        (candidate) =>
          "toolCallId" in candidate &&
          candidate.toolCallId === previousTool.toolCallId
      );
      if (previousToolIndex >= 0) {
        insertAt = previousToolIndex + 1;
        while (result[insertAt]?.type === "reasoning") {
          insertAt += 1;
        }
      }
    }

    result.splice(insertAt, 0, part);
    mergedToolIds.add(part.toolCallId);
  }

  return result;
}

/** Latest stream snapshot; only terminal local tool states are protected. */
export function applyStreamingAssistantSnapshot(
  local: ChatMessagePart[],
  incoming: ChatMessagePart[]
): ChatMessagePart[] {
  const normalizedIncoming = normalizeChatMessageParts(incoming);
  const localTools = new Map(
    local
      .filter((part) => "toolCallId" in part)
      .map((part) => [part.toolCallId, part] as const)
  );
  const merged = normalizedIncoming.map((part) => {
    if (!("toolCallId" in part)) {
      return part;
    }
    const localPart = localTools.get(part.toolCallId);
    return localPart ? mergeToolPart(localPart, part) : part;
  });
  const withLocalTools = preserveLocalOnlyToolParts(local, merged);
  return normalizeChatMessageParts(
    mergeSuffixAfterTerminalTool(local, withLocalTools)
  );
}

/** Persisted assistant message from DB; server parts win with local terminal-tool guard. */
export function applyDbAssistantSnapshot(
  local: ChatMessagePart[],
  server: ChatMessagePart[]
): ChatMessagePart[] {
  const serverParts = normalizeChatMessageParts(server);
  if (
    assistantPartsRichness(serverParts) === 0 &&
    assistantPartsRichness(local) > 0
  ) {
    return normalizeChatMessageParts(local);
  }
  const localTools = new Map(
    local
      .filter((part) => "toolCallId" in part)
      .map((part) => [part.toolCallId, part] as const)
  );
  const merged = serverParts.map((part) => {
    if (!("toolCallId" in part)) {
      return part;
    }
    const localPart = localTools.get(part.toolCallId);
    return localPart ? mergeToolPart(localPart, part) : part;
  });
  const withLocalTools = preserveLocalOnlyToolParts(local, merged);
  return normalizeChatMessageParts(
    mergeSuffixAfterTerminalTool(local, withLocalTools)
  );
}

export function mergeAssistantMessageParts(
  local: ChatMessagePart[],
  incoming: ChatMessagePart[]
): ChatMessagePart[] {
  if (incoming.length === 0) {
    return local;
  }
  if (local.length === 0) {
    return incoming;
  }

  const merged = incoming.map((part, index) => {
    const localPart = local[index];
    if (
      "toolCallId" in part &&
      localPart &&
      "toolCallId" in localPart &&
      part.toolCallId === localPart.toolCallId
    ) {
      return mergeToolPart(localPart, part);
    }

    const localMatch = local.find(
      (candidate) =>
        "toolCallId" in candidate &&
        "toolCallId" in part &&
        candidate.toolCallId === part.toolCallId
    );
    if (localMatch && "toolCallId" in part) {
      return mergeToolPart(localMatch, part);
    }

    return part;
  });
  return preserveLocalTextParts(
    local,
    preserveLocalReasoningParts(local, merged)
  );
}

function appendLocalOnlySuffixParts(
  local: ChatMessagePart[],
  merged: ChatMessagePart[]
): ChatMessagePart[] {
  return mergeSuffixAfterTerminalTool(local, merged);
}

export function mergeAssistantMessagePartsWithSuffix(
  local: ChatMessagePart[],
  incoming: ChatMessagePart[]
): ChatMessagePart[] {
  const merged = mergeAssistantMessageParts(local, incoming);
  return normalizeChatMessageParts(appendLocalOnlySuffixParts(local, merged));
}

export function mergePreservingSuffixParts(
  primary: ChatMessagePart[],
  secondary: ChatMessagePart[],
  merged: ChatMessagePart[]
): ChatMessagePart[] {
  let result = merged;
  result = appendLocalOnlySuffixParts(primary, result);
  result = appendLocalOnlySuffixParts(secondary, result);
  return normalizeChatMessageParts(result);
}

export function mergeAssistantMessageMetadata(
  local: MessageMetadata | undefined,
  incoming: MessageMetadata | undefined,
  mergedParts: ChatMessagePart[]
): MessageMetadata | undefined {
  const mergedMetadata = {
    ...local,
    ...incoming,
    createdAt: local?.createdAt ?? incoming?.createdAt,
  };

  const mergedDenied = mergedParts.some(isDeniedToolPart);
  const pendingCandidates = [
    incoming?.pendingToolApproval,
    local?.pendingToolApproval,
  ].filter(Boolean);
  const activePending = pendingCandidates.find((pending) =>
    mergedParts.some(
      (part) =>
        "toolCallId" in part &&
        "state" in part &&
        part.toolCallId === pending?.toolCallId &&
        part.state === "approval-requested"
    )
  );

  if (mergedDenied) {
    mergedMetadata.pendingToolApproval = undefined;
    if (
      local?.workflowRunStatus === "running" &&
      assistantTurnAwaitingPostDenialContinuation(mergedParts)
    ) {
      mergedMetadata.workflowRunStatus = "running";
    } else if (
      local?.workflowRunStatus === "success" ||
      incoming?.workflowRunStatus === "success"
    ) {
      mergedMetadata.workflowRunStatus = "success";
    } else {
      mergedMetadata.workflowRunStatus =
        local?.workflowRunStatus ?? incoming?.workflowRunStatus;
    }
  } else if (activePending) {
    mergedMetadata.pendingToolApproval = activePending;
    mergedMetadata.workflowRunStatus = "suspended";
  } else {
    mergedMetadata.pendingToolApproval = undefined;
    const terminalStatuses = new Set(["success", "failed", "cancelled"]);
    if (
      incoming?.workflowRunStatus &&
      terminalStatuses.has(incoming.workflowRunStatus)
    ) {
      mergedMetadata.workflowRunStatus = incoming.workflowRunStatus;
    } else if (
      local?.workflowRunStatus &&
      terminalStatuses.has(local.workflowRunStatus)
    ) {
      mergedMetadata.workflowRunStatus = local.workflowRunStatus;
    }
  }

  return mergedMetadata;
}

export function mergeWorkflowChatMessages(
  local: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const localById = new Map(local.map((message) => [message.id, message]));
  const incomingById = new Map(
    incoming.map((message) => [message.id, message])
  );

  const mergeMessage = (incomingMessage: ChatMessage) => {
    const localMessage = localById.get(incomingMessage.id);
    if (
      localMessage?.role !== "assistant" ||
      incomingMessage.role !== "assistant"
    ) {
      return incomingMessage;
    }

    const mergedParts = mergeAssistantMessagePartsWithSuffix(
      localMessage.parts,
      incomingMessage.parts
    );

    return {
      ...incomingMessage,
      metadata: mergeAssistantMessageMetadata(
        localMessage.metadata,
        incomingMessage.metadata,
        mergedParts
      ),
      parts: mergedParts,
    };
  };

  const merged = local.map((localMessage) => {
    const incomingMessage = incomingById.get(localMessage.id);
    return incomingMessage ? mergeMessage(incomingMessage) : localMessage;
  });
  const localIds = new Set(localById.keys());
  for (const incomingMessage of incoming) {
    if (!localIds.has(incomingMessage.id)) {
      merged.push(mergeMessage(incomingMessage));
    }
  }
  return merged;
}
