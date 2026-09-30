import type { ChatMessage } from "../types";
import {
  isApprovalPlaceholderText,
  isSourceSearchToolType,
} from "./activity-parts";
import { isConnectorActionToolType } from "./connector-action-tools";
import { isMcpActionToolType } from "./mcp-action-tools";
import {
  extractTodosFromToolPayload,
  type TodoItem,
  todosAllCompleted,
} from "./todo-types";

export type AssistantMessagePart = ChatMessage["parts"][number];

function isStreamingReasoningPart(part: AssistantMessagePart): boolean {
  return (
    part.type === "reasoning" && "state" in part && part.state === "streaming"
  );
}

export function isRenderableAssistantPart(part: AssistantMessagePart) {
  if (
    "state" in part &&
    part.state === "approval-responded" &&
    !(
      isConnectorActionToolType(part.type) ||
      isMcpActionToolType(part.type) ||
      isSourceSearchToolType(part.type) ||
      part.type === "tool-peopleSearch" ||
      part.type === "tool-createChart" ||
      part.type === "tool-saveToLibrary" ||
      part.type === "tool-importLibraryToSandbox" ||
      part.type === "tool-listLibrary" ||
      part.type === "tool-generateImage" ||
      part.type === "tool-sandboxExec" ||
      part.type === "tool-webSearch" ||
      part.type === "tool-openUrl"
    )
  ) {
    return false;
  }
  if (part.type === "text") {
    return Boolean(part.text?.trim() && !isApprovalPlaceholderText(part.text));
  }
  if (part.type === "reasoning") {
    return Boolean(part.text?.trim()) || isStreamingReasoningPart(part);
  }
  return (
    isSourceSearchToolType(part.type) ||
    part.type === "tool-peopleSearch" ||
    part.type === "tool-createChart" ||
    part.type === "tool-saveToLibrary" ||
    part.type === "tool-importLibraryToSandbox" ||
    part.type === "tool-listLibrary" ||
    part.type === "tool-generateImage" ||
    part.type === "tool-sandboxExec" ||
    part.type === "tool-createDocument" ||
    part.type === "tool-updateDocument" ||
    part.type === "tool-webSearch" ||
    part.type === "tool-openUrl" ||
    isConnectorActionToolType(part.type) ||
    isMcpActionToolType(part.type)
  );
}

export function getLatestTodoPart(
  messageParts: ChatMessage["parts"]
): { index: number; toolCallId: string; todos: TodoItem[] } | null {
  let latest: {
    index: number;
    toolCallId: string;
    todos: TodoItem[];
  } | null = null;
  for (const [index, part] of messageParts.entries()) {
    if (part.type !== "tool-todoWrite") {
      continue;
    }
    const todos = extractTodosFromToolPayload({
      input: "input" in part ? part.input : undefined,
      output: "output" in part ? part.output : undefined,
    });
    if (todos.length > 0) {
      latest = { index, todos, toolCallId: part.toolCallId };
    }
  }
  return latest;
}

export function getLatestChatTodoPlan(messages: ChatMessage[]) {
  const latestUserCreatedAt = messages.reduce((latest, message) => {
    if (message.role !== "user") {
      return latest;
    }
    const createdAt = Date.parse(message.metadata?.createdAt ?? "");
    return Number.isFinite(createdAt) ? Math.max(latest, createdAt) : latest;
  }, Number.NEGATIVE_INFINITY);

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) {
      continue;
    }
    if (message.role === "user") {
      return null;
    }
    if (message.role !== "assistant") {
      continue;
    }
    const latest = getLatestTodoPart(message.parts);
    if (latest) {
      const messageCreatedAt = Date.parse(message.metadata?.createdAt ?? "");
      if (
        Number.isFinite(latestUserCreatedAt) &&
        Number.isFinite(messageCreatedAt) &&
        messageCreatedAt <= latestUserCreatedAt
      ) {
        return null;
      }
      const runStatus = message.metadata?.workflowRunStatus;
      const hasSettledStep = latest.todos.some(
        (todo) => todo.status === "completed" || todo.status === "skipped"
      );
      if (
        !todosAllCompleted(latest.todos) &&
        !hasSettledStep &&
        (runStatus === "success" ||
          runStatus === "failed" ||
          runStatus === "cancelled")
      ) {
        return null;
      }
      return {
        messageId: message.id,
        todos: latest.todos,
        toolCallId: latest.toolCallId,
      };
    }
  }
  return null;
}

/** Part indices in chronological display order. */
export function selectAssistantPartOrder(messageParts: ChatMessage["parts"]) {
  const renderableIndices = messageParts.flatMap((part, index) => {
    if (!isRenderableAssistantPart(part)) {
      return [];
    }
    return [index];
  });
  const latestTodoIndex = renderableIndices.reduce(
    (latest, index) =>
      messageParts[index]?.type === "tool-todoWrite" ? index : latest,
    -1
  );
  const coalesced: number[] = [];
  for (const index of renderableIndices) {
    const part = messageParts[index];
    if (part?.type === "tool-todoWrite" && index !== latestTodoIndex) {
      continue;
    }
    const previousIndex = coalesced.at(-1);
    const previous =
      previousIndex === undefined ? undefined : messageParts[previousIndex];
    if (part?.type === "reasoning" && previous?.type === "reasoning") {
      coalesced[coalesced.length - 1] = index;
    } else {
      coalesced.push(index);
    }
  }
  return coalesced;
}

/** Keeps streamed commentary mounted when reasoning is inserted before it. */
export function getAssistantPartKey(
  messageParts: ChatMessage["parts"],
  partIndex: number
) {
  const part = messageParts[partIndex];
  if (!part) {
    return `missing-${partIndex}`;
  }
  if ("toolCallId" in part && typeof part.toolCallId === "string") {
    return `${part.type}-${part.toolCallId}`;
  }
  if (part.type !== "text") {
    return `${part.type}-${partIndex}`;
  }

  let precedingToolCallId = "start";
  let textOrdinal = 0;
  for (let index = 0; index <= partIndex; index += 1) {
    const candidate = messageParts[index];
    if (!candidate) {
      continue;
    }
    if ("toolCallId" in candidate && typeof candidate.toolCallId === "string") {
      precedingToolCallId = candidate.toolCallId;
      textOrdinal = 0;
    }
    if (
      candidate.type === "text" &&
      candidate.text?.trim() &&
      !isApprovalPlaceholderText(candidate.text)
    ) {
      if (index === partIndex) {
        return `text-after-${precedingToolCallId}-${textOrdinal}`;
      }
      textOrdinal += 1;
    }
  }
  return `text-after-${precedingToolCallId}-${textOrdinal}`;
}

export function isToolAssistantPart(part: AssistantMessagePart) {
  return part.type.startsWith("tool-") && part.type !== "tool-todoWrite";
}

export function isImmediateApprovalPart(part: AssistantMessagePart) {
  return (
    isToolAssistantPart(part) &&
    "state" in part &&
    part.state === "approval-requested"
  );
}

export function isReasoningPartRevealing(
  part: AssistantMessagePart,
  isMessageStreaming: boolean
) {
  return (
    part.type === "reasoning" &&
    isMessageStreaming &&
    "state" in part &&
    part.state === "streaming" &&
    Boolean(part.text?.trim())
  );
}

/** Hide a tool until preceding Thought/commentary finishes revealing. */
export function shouldDeferAssistantPartReveal(args: {
  messageParts: ChatMessage["parts"];
  partIndex: number;
  isMessageStreaming: boolean;
  revealingNarratives: Record<string, boolean>;
}) {
  const { messageParts, partIndex, isMessageStreaming, revealingNarratives } =
    args;
  if (!isMessageStreaming) {
    return false;
  }
  const current = messageParts[partIndex];
  if (!current || isImmediateApprovalPart(current)) {
    return false;
  }
  const hasNewerRenderablePart = messageParts
    .slice(partIndex + 1)
    .some(
      (part) =>
        part.type !== "tool-todoWrite" && isRenderableAssistantPart(part)
    );
  if (hasNewerRenderablePart) {
    return false;
  }

  for (let index = partIndex - 1; index >= 0; index -= 1) {
    const previous = messageParts[index];
    if (!previous) {
      continue;
    }
    if (isToolAssistantPart(previous)) {
      break;
    }
    if (previous.type === "tool-todoWrite") {
      continue;
    }
    if (isReasoningPartRevealing(previous, isMessageStreaming)) {
      return true;
    }
    if (
      previous.type === "text" &&
      revealingNarratives[getAssistantPartKey(messageParts, index)] === true
    ) {
      return true;
    }
  }
  return false;
}
