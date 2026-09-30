export const CONFLUENCE_ACTION_TOOL_IDS = [
  "confluenceCreateSpace",
  "confluenceCreatePage",
  "confluenceRenamePage",
  "confluenceUpdatePage",
  "confluenceMovePage",
] as const;
export const CONFLUENCE_TOOL_IDS = [...CONFLUENCE_ACTION_TOOL_IDS] as const;

export function confluenceToolIdsForConnector(): string[] {
  return [...CONFLUENCE_ACTION_TOOL_IDS];
}
