export const NOTION_ACTION_TOOL_IDS = [
  "notionCreatePage",
  "notionCreateDatabase",
  "notionRenamePage",
  "notionUpdatePage",
  "notionMovePage",
  "notionDbCreateRow",
  "notionDbRenameRow",
  "notionDbUpdateRow",
  "notionDbMoveRow",
] as const;
export const NOTION_TOOL_IDS = [...NOTION_ACTION_TOOL_IDS] as const;

export function notionToolIdsForConnector(): string[] {
  return [...NOTION_ACTION_TOOL_IDS];
}
