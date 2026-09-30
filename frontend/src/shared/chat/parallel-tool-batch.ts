import type { ConnectorProvider } from "@/contracts/connectors";
import { selectAssistantPartOrder } from "@/shared/chat/assistant-message-parts";
import {
  type ConnectorActionToolType,
  getConnectionActionToolMeta,
  isConnectorActionToolType,
} from "@/shared/chat/connector-action-tools";
import { isToolPartPendingForDisplay } from "@/shared/chat/tool-part-pending";
import type { ChatMessage, ChatMessagePart } from "@/shared/types";

export type ToolCallAggregateStatus = "pending" | "completed" | "failed";

export type AssistantRenderBlock =
  | { kind: "part"; partIndex: number }
  | {
      kind: "toolGroup";
      partIndices: number[];
      provider: ConnectorProvider;
    };

export function isToolMessagePart(part: ChatMessagePart): boolean {
  return part.type.startsWith("tool-") && "toolCallId" in part;
}

function isConnectorToolApprovalPart(part: ChatMessagePart): boolean {
  return (
    isConnectorActionToolType(part.type) &&
    "state" in part &&
    part.state === "approval-requested"
  );
}

/** Connector tools that can share a contiguous provider group in the UI. */
export function isGroupableConnectorToolPart(part: ChatMessagePart): boolean {
  return (
    isToolMessagePart(part) &&
    isConnectorActionToolType(part.type) &&
    !isConnectorToolApprovalPart(part)
  );
}

export function getConnectorToolProvider(
  part: ChatMessagePart
): ConnectorProvider | null {
  if (!isConnectorActionToolType(part.type)) {
    return null;
  }
  return getConnectionActionToolMeta(part.type as ConnectorActionToolType)
    .provider;
}

/** Contiguous tool rows with no text/reasoning between them (one parallel batch). */
export function parallelToolBatchBounds(
  parts: ChatMessagePart[],
  toolIndex: number
): { start: number; end: number } {
  let start = toolIndex;
  let end = toolIndex;

  for (let index = toolIndex - 1; index >= 0; index -= 1) {
    if (!isToolMessagePart(parts[index])) {
      break;
    }
    start = index;
  }

  for (let index = toolIndex + 1; index < parts.length; index += 1) {
    if (!isToolMessagePart(parts[index])) {
      break;
    }
    end = index;
  }

  return { end, start };
}

export function parallelToolBatchBoundsForToolCall(
  parts: ChatMessagePart[],
  toolCallId: string
): { start: number; end: number } | null {
  const toolIndex = parts.findIndex(
    (part) => "toolCallId" in part && part.toolCallId === toolCallId
  );
  if (toolIndex < 0) {
    return null;
  }
  return parallelToolBatchBounds(parts, toolIndex);
}

function partHasOutputError(part: ChatMessagePart): boolean {
  if (!("state" in part)) {
    return false;
  }
  if (part.state === "output-error") {
    return true;
  }
  if (!("output" in part) || !part.output || typeof part.output !== "object") {
    return false;
  }
  const output = part.output as Record<string, unknown>;
  return typeof output.error === "string" && output.error.trim().length > 0;
}

function isToolPartPending(
  part: ChatMessagePart,
  isMessageStreaming = true
): boolean {
  if (!("state" in part) || typeof part.state !== "string") {
    return false;
  }
  return isToolPartPendingForDisplay({
    hasOutput: "output" in part ? part.output !== undefined : undefined,
    isMessageStreaming,
    state: part.state,
  });
}

/** Map a tool message part to a compact status for grouped headers and rows. */
export function getToolPartAggregateStatus(
  part: ChatMessagePart,
  options?: { isMessageStreaming?: boolean }
): ToolCallAggregateStatus {
  const isMessageStreaming = options?.isMessageStreaming ?? true;
  if (!isToolMessagePart(part)) {
    return "completed";
  }
  if (isToolPartPending(part, isMessageStreaming)) {
    return "pending";
  }
  if (
    partHasOutputError(part) ||
    ("state" in part &&
      (part.state === "output-error" || part.state === "output-denied"))
  ) {
    return "failed";
  }
  return "completed";
}

export function aggregateToolPartStatuses(
  parts: ChatMessagePart[],
  options?: { isMessageStreaming?: boolean }
): ToolCallAggregateStatus {
  if (
    parts.some(
      (part) => getToolPartAggregateStatus(part, options) === "pending"
    )
  ) {
    return "pending";
  }
  if (
    parts.some((part) => getToolPartAggregateStatus(part, options) === "failed")
  ) {
    return "failed";
  }
  return "completed";
}

function collectContiguousConnectorGroup(
  messageParts: ChatMessage["parts"],
  displayOrder: number[],
  startIndex: number
): { partIndices: number[]; nextIndex: number; provider: ConnectorProvider } {
  const firstPartIndex = displayOrder[startIndex];
  const firstPart = messageParts[firstPartIndex];
  const provider = getConnectorToolProvider(firstPart);
  if (!firstPart || !provider || !isGroupableConnectorToolPart(firstPart)) {
    return {
      nextIndex: startIndex + 1,
      partIndices: firstPartIndex === undefined ? [] : [firstPartIndex],
      provider: provider ?? "slack",
    };
  }

  const partIndices = [firstPartIndex];
  let nextIndex = startIndex + 1;
  while (nextIndex < displayOrder.length) {
    const partIndex = displayOrder[nextIndex];
    const part = messageParts[partIndex];
    if (
      !part ||
      !isGroupableConnectorToolPart(part) ||
      getConnectorToolProvider(part) !== provider
    ) {
      break;
    }
    partIndices.push(partIndex);
    nextIndex += 1;
  }

  return { nextIndex, partIndices, provider };
}

/** Groups contiguous same-provider connector tools; everything else stays flat. */
export function buildAssistantRenderBlocks(
  messageParts: ChatMessage["parts"]
): AssistantRenderBlock[] {
  const displayOrder = selectAssistantPartOrder(messageParts);
  const blocks: AssistantRenderBlock[] = [];
  let index = 0;

  while (index < displayOrder.length) {
    const partIndex = displayOrder[index];
    const part = messageParts[partIndex];
    if (!part) {
      index += 1;
      continue;
    }

    if (!isGroupableConnectorToolPart(part)) {
      blocks.push({ kind: "part", partIndex });
      index += 1;
      continue;
    }

    const group = collectContiguousConnectorGroup(
      messageParts,
      displayOrder,
      index
    );
    if (group.partIndices.length >= 2) {
      blocks.push({
        kind: "toolGroup",
        partIndices: group.partIndices,
        provider: group.provider,
      });
    } else if (group.partIndices[0] !== undefined) {
      blocks.push({ kind: "part", partIndex: group.partIndices[0] });
    }
    index = group.nextIndex;
  }

  return blocks;
}
