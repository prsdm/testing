export const SHAREPOINT_ACTION_TOOL_IDS = [
  "sharePointCreatePage",
  "sharePointRenamePage",
  "sharePointUpdatePage",
] as const;
export const SHAREPOINT_TOOL_IDS = [...SHAREPOINT_ACTION_TOOL_IDS] as const;

export function sharePointToolIdsForConnector(): string[] {
  return [...SHAREPOINT_ACTION_TOOL_IDS];
}
