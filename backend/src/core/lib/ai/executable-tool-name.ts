import type { ToolSet } from "ai";
import { isKnowledgeBaseScopeSourceSearchInput } from "@/shared/knowledge-bases/knowledge-base-search-scope";
import type { ChatMessagePart } from "@/shared/types";

export function uiToolNameFromPartType(partType: string): string | undefined {
  if (!partType.startsWith("tool-")) {
    return undefined;
  }
  return partType.slice("tool-".length);
}

export function readOriginalToolName(
  part: ChatMessagePart
): string | undefined {
  if (
    "originalToolName" in part &&
    typeof part.originalToolName === "string" &&
    part.originalToolName.trim()
  ) {
    return part.originalToolName.trim();
  }
  return uiToolNameFromPartType(part.type);
}

/** Resolve the registered AI SDK tool name for execution and model replay. */
export function resolveExecutableToolName(
  part: ChatMessagePart,
  tools: ToolSet
): string | undefined {
  if (!part.type.startsWith("tool-") || !("toolCallId" in part)) {
    return undefined;
  }

  const original = readOriginalToolName(part);
  if (original && tools[original]) {
    return original;
  }
  if (original === "listProjects" && tools.listKnowledgeBases) {
    return "listKnowledgeBases";
  }
  if (original === "projectSearch" && tools.knowledgeBaseSearch) {
    return "knowledgeBaseSearch";
  }

  const uiName = uiToolNameFromPartType(part.type);
  if (uiName && tools[uiName]) {
    return uiName;
  }

  if (
    uiName === "sourceSearch" &&
    tools.knowledgeBaseSearch &&
    isKnowledgeBaseScopeSourceSearchInput(part.input)
  ) {
    return "knowledgeBaseSearch";
  }

  return uiName;
}

export function withOriginalToolName(
  part: ChatMessagePart,
  toolName: string
): ChatMessagePart {
  if (!part.type.startsWith("tool-")) {
    return part;
  }
  return {
    ...part,
    originalToolName: toolName,
  } as ChatMessagePart;
}
