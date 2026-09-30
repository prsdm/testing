import type { Provider } from "@/core/lib/connectors/providers/types";

export const NOTION_PROVIDER_ID = "notion";

export const notionProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Productivity",
  description:
    "Connect your Notion account to sync sources and create or update pages from chat.",
  iconColor: "bg-neutral-500",
  id: NOTION_PROVIDER_ID,
  name: "Notion",
  scopes: [],
  tools: [
    {
      description:
        "Create a Notion page. Omit parent to add at workspace root (Private); optionally nest under a parent page.",
      id: "notionCreatePage",
      name: "Create Notion page",
    },
    {
      description:
        "Create a Notion database. Omit parent for workspace root (Private); optionally nest under a parent page. Defaults to Name + Status columns.",
      id: "notionCreateDatabase",
      name: "Create Notion database",
    },
    {
      description:
        "Rename a Notion page title only. Pass pageId or pageTitle for the current title.",
      id: "notionRenamePage",
      name: "Rename Notion page",
    },
    {
      description:
        "Append or replace Notion page body content. Use notionRenamePage to change the title.",
      id: "notionUpdatePage",
      name: "Update Notion page",
    },
    {
      description: "Move a Notion page under a different parent page.",
      id: "notionMovePage",
      name: "Move Notion page",
    },
    {
      description:
        "Create a database row with optional Status, Assignee, and other property columns plus body content.",
      id: "notionDbCreateRow",
      name: "Create Notion database row",
    },
    {
      description:
        "Rename a database row title only. Prefer rowId from a prior tool result in this chat.",
      id: "notionDbRenameRow",
      name: "Rename Notion database row",
    },
    {
      description:
        "Update database row properties and/or append or replace row body content. Use notionDbRenameRow to change the title.",
      id: "notionDbUpdateRow",
      name: "Update Notion database row",
    },
    {
      description:
        "Move a database row to another database or under a parent page.",
      id: "notionDbMoveRow",
      name: "Move Notion database row",
    },
  ],
};
