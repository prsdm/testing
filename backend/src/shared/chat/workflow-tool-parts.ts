import { isConnectorActionToolType } from "@/shared/chat/connector-action-tools";
import { coalescePostTerminalSuffixTexts } from "@/shared/chat/denied-tool-suffix";
import {
  compactReasoningComparisonKey,
  reasoningComparisonKey,
} from "@/shared/chat/thinking-text";
import {
  extractTodosFromToolPayload,
  normalizeTodoItems,
} from "@/shared/chat/todo-types";
import { buildKnowledgeBaseSearchToolPart } from "@/shared/knowledge-bases/knowledge-base-search-ui";
import type { InternalSearchToolOutput } from "@/shared/search/citations";
import type { ChatMessagePart } from "@/shared/types";

const CITATION_TOOL_NAMES = new Set([
  "knowledgeBaseSearch",
  "sourceSearch",
  "knowledgeSearch",
  "webSearch",
]);

const INLINE_STREAM_TOOL_NAMES = new Set([
  "peopleSearch",
  "createChart",
  "saveToLibrary",
  "importLibraryToSandbox",
  "listLibrary",
  "generateImage",
  "sandboxExec",
  "createDocument",
  "updateDocument",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractSearchOutput(result: unknown): InternalSearchToolOutput | null {
  const root = asRecord(result);
  if (!root) {
    return null;
  }

  const nested = asRecord(root.output);
  if (nested && Array.isArray(nested.documents)) {
    return nested as InternalSearchToolOutput;
  }

  if (Array.isArray(root.documents)) {
    return root as InternalSearchToolOutput;
  }

  return null;
}

function toolTypeForName(
  toolName: string
): "tool-sourceSearch" | "tool-knowledgeSearch" | "tool-webSearch" | null {
  switch (toolName) {
    case "knowledgeBaseSearch":
    case "sourceSearch":
      return "tool-sourceSearch";
    case "knowledgeSearch":
      return "tool-knowledgeSearch";
    case "webSearch":
      return "tool-webSearch";
    default:
      return null;
  }
}

function queryFromArgs(args: Record<string, unknown> | null): string {
  if (!args) {
    return "";
  }
  if (typeof args.query === "string") {
    return args.query;
  }
  if (Array.isArray(args.queries) && typeof args.queries[0] === "string") {
    return args.queries[0];
  }
  return "";
}

function knowledgeBaseNameFromArgs(
  args: Record<string, unknown> | null
): string | undefined {
  const knowledgeBaseName = args?.knowledgeBaseName;
  return typeof knowledgeBaseName === "string" && knowledgeBaseName.trim()
    ? knowledgeBaseName.trim()
    : undefined;
}

function isTodoWriteToolName(toolName: string) {
  return toolName === "todoWrite" || toolName === "todowrite";
}

function toolPartTypeForName(toolName: string): `tool-${string}` {
  return `tool-${toolName}`;
}

function isInlineStreamToolName(toolName: string) {
  const type = toolPartTypeForName(toolName);
  return (
    INLINE_STREAM_TOOL_NAMES.has(toolName) || isConnectorActionToolType(type)
  );
}

function extractInlineToolOutput(result: unknown): unknown {
  const root = asRecord(result);
  if (!root) {
    return result;
  }
  const nested = asRecord(root.output);
  return nested ?? root;
}

function inlineToolResultState(output: unknown) {
  const record = asRecord(output);
  if (record?.type === "execution-denied") {
    const reason =
      typeof record.reason === "string" && record.reason.trim()
        ? record.reason.trim()
        : "Rejected by user";
    return {
      errorText: reason,
      state: "output-error" as const,
    };
  }
  if (record?.error && typeof record.error === "string") {
    return {
      errorText: record.error,
      state: "output-error" as const,
    };
  }
  return { state: "output-available" as const };
}

function buildInlineStreamToolPart(args: {
  toolCallId: string;
  toolName: string;
  state: "input-available" | "output-available" | "output-error";
  toolArgs?: Record<string, unknown> | null;
  result?: unknown;
  errorText?: string;
}): ChatMessagePart | null {
  if (!args.toolCallId || !isInlineStreamToolName(args.toolName)) {
    return null;
  }

  const type = toolPartTypeForName(args.toolName);
  const input = args.toolArgs ?? {};

  if (args.state === "input-available") {
    return {
      input,
      state: "input-available",
      toolCallId: args.toolCallId,
      type,
    } as ChatMessagePart;
  }

  const output = extractInlineToolOutput(args.result);
  const resolvedState =
    args.state === "output-error"
      ? {
          errorText: args.errorText,
          state: "output-error" as const,
        }
      : inlineToolResultState(output);

  return {
    input,
    output,
    state: resolvedState.state,
    toolCallId: args.toolCallId,
    type,
    ...(resolvedState.state === "output-error" && resolvedState.errorText
      ? { errorText: resolvedState.errorText }
      : {}),
  } as ChatMessagePart;
}

function buildTodoWriteToolPart(args: {
  toolCallId: string;
  state: "input-available" | "output-available";
  toolArgs?: Record<string, unknown> | null;
  result?: unknown;
}): ChatMessagePart | null {
  const todosFromArgs = normalizeTodoItems(args.toolArgs?.todos);
  const todos = extractTodosFromToolPayload({
    input: args.toolArgs ?? undefined,
    output: args.result,
  });
  const resolvedTodos =
    todos.length > 0 ? todos : todosFromArgs.length > 0 ? todosFromArgs : [];

  if (resolvedTodos.length === 0) {
    return null;
  }

  return {
    input: { todos: resolvedTodos },
    state: args.state,
    toolCallId: args.toolCallId,
    type: "tool-todoWrite",
    ...(args.state === "output-available"
      ? { output: { todos: resolvedTodos } }
      : {}),
  } as ChatMessagePart;
}

export function buildWorkflowToolPartFromCall(args: {
  toolCallId: string;
  toolName: string;
  toolArgs?: Record<string, unknown> | null;
}): ChatMessagePart | null {
  if (args.toolCallId && isTodoWriteToolName(args.toolName)) {
    return buildTodoWriteToolPart({
      state: "input-available",
      toolArgs: args.toolArgs,
      toolCallId: args.toolCallId,
    });
  }

  if (!args.toolCallId) {
    return null;
  }

  if (!CITATION_TOOL_NAMES.has(args.toolName)) {
    return buildInlineStreamToolPart({
      state: "input-available",
      toolArgs: args.toolArgs,
      toolCallId: args.toolCallId,
      toolName: args.toolName,
    });
  }

  const query = queryFromArgs(args.toolArgs ?? null);
  if (
    args.toolName === "knowledgeBaseSearch" ||
    args.toolName === "sourceSearch"
  ) {
    return buildKnowledgeBaseSearchToolPart({
      knowledgeBaseName: knowledgeBaseNameFromArgs(args.toolArgs ?? null),
      query: query || "knowledge base search",
      state: "input-available",
      toolCallId: args.toolCallId,
    });
  }

  const type = toolTypeForName(args.toolName);
  if (!type) {
    return null;
  }

  return {
    input: args.toolArgs ?? (query ? { query } : {}),
    state: "input-available",
    toolCallId: args.toolCallId,
    type,
  } as ChatMessagePart;
}

export function buildWorkflowToolPartFromResult(args: {
  toolCallId: string;
  toolName: string;
  result: unknown;
  toolArgs?: Record<string, unknown> | null;
  errorText?: string;
}): ChatMessagePart | null {
  if (args.toolCallId && isTodoWriteToolName(args.toolName)) {
    return buildTodoWriteToolPart({
      result: args.result,
      state: "output-available",
      toolArgs: args.toolArgs,
      toolCallId: args.toolCallId,
    });
  }

  if (!args.toolCallId) {
    return null;
  }

  if (!CITATION_TOOL_NAMES.has(args.toolName)) {
    return buildInlineStreamToolPart({
      errorText: args.errorText,
      result: args.result,
      state: args.errorText ? "output-error" : "output-available",
      toolArgs: args.toolArgs,
      toolCallId: args.toolCallId,
      toolName: args.toolName,
    });
  }

  const output = extractSearchOutput(args.result);
  if (!output) {
    return null;
  }

  const resultInput = asRecord(asRecord(args.result)?.input);
  const toolArgs =
    resultInput || args.toolArgs
      ? { ...(resultInput ?? {}), ...(args.toolArgs ?? {}) }
      : null;
  const query = queryFromArgs(toolArgs);

  if (
    args.toolName === "knowledgeBaseSearch" ||
    args.toolName === "sourceSearch"
  ) {
    return buildKnowledgeBaseSearchToolPart({
      knowledgeBaseName: knowledgeBaseNameFromArgs(toolArgs),
      output,
      query: query || "knowledge base search",
      state: "output-available",
      toolCallId: args.toolCallId,
    });
  }

  const type = toolTypeForName(args.toolName);
  if (!type) {
    return null;
  }

  return {
    input: toolArgs ?? { query },
    output,
    state: "output-available",
    toolCallId: args.toolCallId,
    type,
  } as ChatMessagePart;
}

export function normalizeStoredToolPart(
  part: ChatMessagePart
): ChatMessagePart {
  if (!part.type.startsWith("tool-") || !("toolCallId" in part)) {
    return part;
  }

  const toolName = part.type.slice("tool-".length);
  const input =
    "input" in part && part.input && typeof part.input === "object"
      ? (part.input as Record<string, unknown>)
      : null;
  const state = "state" in part ? part.state : undefined;

  if (state === "input-available" || state === "input-streaming") {
    return (
      buildWorkflowToolPartFromCall({
        toolArgs: input,
        toolCallId: part.toolCallId,
        toolName,
      }) ?? part
    );
  }

  if (state === "approval-requested") {
    const normalized =
      buildWorkflowToolPartFromCall({
        toolArgs: input,
        toolCallId: part.toolCallId,
        toolName,
      }) ?? part;
    return {
      ...normalized,
      state: "approval-requested",
      ...("approval" in part && part.approval
        ? { approval: part.approval }
        : {}),
    } as ChatMessagePart;
  }

  if (state === "output-denied") {
    return part;
  }

  if (state === "output-available" || state === "output-error") {
    const output = "output" in part ? part.output : undefined;
    const errorText =
      "errorText" in part && typeof part.errorText === "string"
        ? part.errorText
        : undefined;
    return (
      buildWorkflowToolPartFromResult({
        errorText,
        result: output,
        toolArgs: input,
        toolCallId: part.toolCallId,
        toolName,
      }) ??
      buildWorkflowToolPartFromCall({
        toolArgs: input,
        toolCallId: part.toolCallId,
        toolName,
      }) ??
      part
    );
  }

  return part;
}

export function orderReasoningBeforeNarrativeParts(
  parts: ChatMessagePart[]
): ChatMessagePart[] {
  const ordered: ChatMessagePart[] = [];
  let segment: ChatMessagePart[] = [];
  const flushSegment = () => {
    ordered.push(
      ...segment.filter((part) => part.type === "reasoning"),
      ...segment.filter((part) => part.type !== "reasoning")
    );
    segment = [];
  };

  for (const part of parts) {
    if ("toolCallId" in part) {
      flushSegment();
      ordered.push(part);
    } else {
      segment.push(part);
    }
  }
  flushSegment();
  return ordered;
}

function dropExactDuplicateTextParts(
  parts: ChatMessagePart[]
): ChatMessagePart[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    if (part.type !== "text") {
      return true;
    }
    const key = part.text.trim();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function keepLatestPreToolText(
  parts: ChatMessagePart[]
): ChatMessagePart[] {
  const result: ChatMessagePart[] = [];
  let index = 0;

  while (index < parts.length) {
    const part = parts[index];
    if (part && "toolCallId" in part) {
      result.push(part);
      index += 1;
      continue;
    }

    const segmentStart = index;
    while (index < parts.length) {
      const current = parts[index];
      if (current && "toolCallId" in current) {
        break;
      }
      index += 1;
    }
    const segment = parts.slice(segmentStart, index);
    const endsBeforeTool = index < parts.length;

    if (endsBeforeTool) {
      let lastText: ChatMessagePart | undefined;
      for (const segmentPart of segment) {
        if (segmentPart.type === "text") {
          lastText = segmentPart;
        }
      }
      for (const segmentPart of segment) {
        if (segmentPart.type === "text" && segmentPart !== lastText) {
          continue;
        }
        result.push(segmentPart);
      }
      continue;
    }

    result.push(...dropExactDuplicateTextParts(segment));
  }

  return result;
}

export function normalizeChatMessageParts(
  parts: ChatMessagePart[]
): ChatMessagePart[] {
  const normalized = parts
    .map((part) => normalizeStoredToolPart(part))
    .filter((part): part is ChatMessagePart => {
      if (part.type === "text") {
        return Boolean(part.text?.trim());
      }
      if (part.type === "reasoning") {
        return Boolean(part.text?.trim());
      }
      return part !== null;
    });

  const deduped: ChatMessagePart[] = [];
  const seenText = new Set<string>();
  const toolIndexByCallId = new Map<string, number>();
  const toolStateRank = (part: ChatMessagePart) => {
    if (!("state" in part)) {
      return 0;
    }
    switch (part.state) {
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
  for (const part of normalized) {
    if ("toolCallId" in part) {
      const existingIndex = toolIndexByCallId.get(part.toolCallId);
      if (existingIndex === undefined) {
        toolIndexByCallId.set(part.toolCallId, deduped.length);
        deduped.push(part);
        continue;
      }
      const existing = deduped[existingIndex];
      if (existing && toolStateRank(part) >= toolStateRank(existing)) {
        const incomingInput = "input" in part ? part.input : undefined;
        const incomingInputIsEmpty =
          incomingInput === undefined ||
          incomingInput === null ||
          (typeof incomingInput === "object" &&
            !Array.isArray(incomingInput) &&
            Object.keys(incomingInput).length === 0);
        deduped[existingIndex] =
          incomingInputIsEmpty && "input" in existing
            ? ({ ...part, input: existing.input } as ChatMessagePart)
            : part;
      }
      continue;
    }
    if (part.type === "reasoning") {
      const previous = deduped.at(-1);
      if (previous?.type === "reasoning") {
        const previousText = reasoningComparisonKey(previous.text);
        const currentText = reasoningComparisonKey(part.text);
        if (
          compactReasoningComparisonKey(previous.text) !==
            compactReasoningComparisonKey(part.text) &&
          currentText.length > previousText.length
        ) {
          deduped[deduped.length - 1] = part;
        }
        continue;
      }
      deduped.push(part);
      continue;
    }
    if (part.type !== "text") {
      deduped.push(part);
      continue;
    }
    const key = part.text.trim();
    if (seenText.has(key)) {
      continue;
    }
    seenText.add(key);
    deduped.push(part);
  }

  return orderReasoningBeforeNarrativeParts(
    coalescePostTerminalSuffixTexts(keepLatestPreToolText(deduped))
  );
}
