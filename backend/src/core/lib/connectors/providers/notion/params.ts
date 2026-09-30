import type { ToolParam } from "@/core/lib/connectors/providers/types";

const NOTION_ROW_PROPERTIES_DESCRIPTION =
  'Notion property JSON. Status: {"Status":{"status":{"name":"In progress"}}}. Assignee by name/email: {"Assignee":"prsdm"} or {"Assignee":{"people":[{"name":"prsdm"}]}}. Select: {"Priority":{"select":{"name":"High"}}}. Use exact property names from the database.';

export const NOTION_PARAMS: Record<string, ToolParam[]> = {
  notionCreateDatabase: [
    {
      description:
        "Optional parent page ID. Omit both parent fields to create at workspace root (Private); use parentPageTitle or parentPageId to nest under a page.",
      name: "parentPageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional parent page title when nesting under a page. Omit with parentPageId for workspace root.",
      name: "parentPageTitle",
      required: false,
      type: "string",
    },
    {
      description: "Database title",
      name: "title",
      required: true,
      type: "string",
    },
    {
      description:
        'Optional JSON schema for database columns. Defaults to {"Name":{"title":{}},"Status":{"status":{}}}. Use status (not select) for Status columns.',
      name: "properties",
      required: false,
      type: "string",
    },
  ],
  notionCreatePage: [
    {
      description:
        "Optional parent page ID. Omit both parent fields to create a top-level workspace page (appears in Private); use parentPageTitle or parentPageId to nest under an existing page.",
      name: "parentPageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional parent page title when nesting under an existing page. Omit with parentPageId to create at workspace root.",
      name: "parentPageTitle",
      required: false,
      type: "string",
    },
    {
      description: "Page title",
      name: "title",
      required: true,
      type: "string",
    },
    {
      description:
        "Initial page body. Prefer one call with the full draft. Supports # headings, - bullets, and - [ ] todos.",
      name: "content",
      required: false,
      type: "string",
    },
  ],
  notionDbCreateRow: [
    {
      description:
        "Notion database ID from a prior tool result, or a database URL",
      name: "databaseId",
      required: false,
      type: "string",
    },
    {
      description:
        "Database name when databaseId is unknown. Resolved via Notion search; share the database with this connection.",
      name: "databaseTitle",
      required: false,
      type: "string",
    },
    {
      description: "Row title (maps to the database title property)",
      name: "title",
      required: true,
      type: "string",
    },
    {
      description: NOTION_ROW_PROPERTIES_DESCRIPTION,
      name: "properties",
      required: false,
      type: "string",
    },
    {
      description:
        "Row body blocks. Supports # headings, - bullets, and - [ ] todos.",
      name: "content",
      required: false,
      type: "string",
    },
  ],
  notionDbMoveRow: [
    {
      description: "Source database ID when resolving row by rowTitle",
      name: "databaseId",
      required: false,
      type: "string",
    },
    {
      description: "Source database name when resolving row by rowTitle",
      name: "databaseTitle",
      required: false,
      type: "string",
    },
    {
      description: "Row to move",
      name: "rowId",
      required: false,
      type: "string",
    },
    {
      description: "Row title when rowId is unknown",
      name: "rowTitle",
      required: false,
      type: "string",
    },
    {
      description:
        "Destination database ID — use this OR toParentPageId/toParentPageTitle, not both",
      name: "toDatabaseId",
      required: false,
      type: "string",
    },
    {
      description: "Destination database name",
      name: "toDatabaseTitle",
      required: false,
      type: "string",
    },
    {
      description:
        "Destination parent page ID — moves row out of database under a page",
      name: "toParentPageId",
      required: false,
      type: "string",
    },
    {
      description: "Destination parent page title",
      name: "toParentPageTitle",
      required: false,
      type: "string",
    },
  ],
  notionDbRenameRow: [
    {
      description: "Database ID when resolving row by rowTitle",
      name: "databaseId",
      required: false,
      type: "string",
    },
    {
      description: "Database name when resolving row by rowTitle",
      name: "databaseTitle",
      required: false,
      type: "string",
    },
    {
      description:
        "Notion row UUID from a prior tool result in this chat. Do not invent placeholder IDs — use rowTitle + databaseTitle instead.",
      name: "rowId",
      required: false,
      type: "string",
    },
    {
      description: "Row title when rowId is unknown",
      name: "rowTitle",
      required: false,
      type: "string",
    },
    {
      description: "New row title",
      name: "title",
      required: true,
      type: "string",
    },
  ],
  notionDbUpdateRow: [
    {
      description: "Database ID when resolving row by rowTitle",
      name: "databaseId",
      required: false,
      type: "string",
    },
    {
      description: "Database name when resolving row by rowTitle",
      name: "databaseTitle",
      required: false,
      type: "string",
    },
    {
      description:
        "Notion row UUID from a prior tool result in this chat. Enough on its own to update assignee, status, title, or body. Do not invent placeholder IDs — use rowTitle + databaseTitle instead.",
      name: "rowId",
      required: false,
      type: "string",
    },
    {
      description: "Row title when rowId is unknown",
      name: "rowTitle",
      required: false,
      type: "string",
    },
    {
      description: NOTION_ROW_PROPERTIES_DESCRIPTION,
      name: "properties",
      required: false,
      type: "string",
    },
    {
      description: "Row body content",
      name: "content",
      required: false,
      type: "string",
    },
    {
      description: '"append" (default) or "replace" for row body content',
      name: "contentMode",
      required: false,
      type: "string",
    },
  ],
  notionMovePage: [
    {
      description:
        "Page to move — ID from a prior tool result in this chat, or a Notion page link",
      name: "pageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Page title when pageId is unknown. Resolved via Notion search; prefer pageId when available.",
      name: "pageTitle",
      required: false,
      type: "string",
    },
    {
      description: "Destination parent page ID",
      name: "parentPageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Destination parent page title when parentPageId is unknown. Resolved via Notion search.",
      name: "parentPageTitle",
      required: false,
      type: "string",
    },
  ],
  notionRenamePage: [
    {
      description:
        "Notion page ID from a prior tool result in this chat, or a Notion page link",
      name: "pageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Page title when pageId is unknown. Resolved via Notion search; prefer pageId when available.",
      name: "pageTitle",
      required: false,
      type: "string",
    },
    {
      description: "New page title",
      name: "title",
      required: true,
      type: "string",
    },
  ],
  notionUpdatePage: [
    {
      description:
        "Notion page ID from a prior tool result in this chat, or a Notion page link",
      name: "pageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Page title when pageId is unknown. Resolved via Notion search; prefer pageId when available.",
      name: "pageTitle",
      required: false,
      type: "string",
    },
    {
      description:
        "Page body content. Supports # headings, - bullets, and - [ ] todos.",
      name: "content",
      required: true,
      type: "string",
    },
    {
      description:
        'How to apply content: "append" (default) or "replace" to overwrite existing body blocks',
      name: "contentMode",
      required: false,
      type: "string",
    },
  ],
};
