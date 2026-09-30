export const KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG =
  "knowledgeBaseScope" as const;

/** @deprecated Stored on older tool parts; still recognized when reading history. */
export const LEGACY_KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG =
  "projectScope" as const;

export function isKnowledgeBaseScopeSourceSearchInput(input: unknown): boolean {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  const record = input as Record<string, unknown>;
  return (
    record[KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG] === true ||
    record[LEGACY_KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG] === true
  );
}
