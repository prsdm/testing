import type { ToolParam } from "@/core/lib/connectors/providers/types";

const PAGE_ID_PARAM: ToolParam = {
  description:
    "Confluence page ID from a prior tool result in this chat, a numeric page ID, or a Confluence page URL",
  name: "pageId",
  required: false,
  type: "string",
};

const PAGE_TITLE_PARAM: ToolParam = {
  description:
    "Page title when pageId is unknown. Resolved via Confluence search; add spaceKey when titles collide.",
  name: "pageTitle",
  required: false,
  type: "string",
};

const SPACE_KEY_PARAM: ToolParam = {
  description:
    "Confluence space key (for example ENG). Helps disambiguate pageTitle lookups and is required for create.",
  name: "spaceKey",
  required: false,
  type: "string",
};

export const CONFLUENCE_PARAMS: Record<string, ToolParam[]> = {
  confluenceCreatePage: [
    {
      ...SPACE_KEY_PARAM,
      description:
        "Confluence space key where the page should be created (for example ENG, PROD)",
      required: true,
    },
    {
      description: "Page title",
      name: "title",
      required: true,
      type: "string",
    },
    {
      description: "Initial page body plain text",
      name: "content",
      required: false,
      type: "string",
    },
    {
      description: "Optional parent page ID or URL",
      name: "parentPageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Optional parent page title when parentPageId is unknown. Uses spaceKey to narrow search.",
      name: "parentPageTitle",
      required: false,
      type: "string",
    },
  ],
  confluenceCreateSpace: [
    {
      description:
        "Confluence space key (uppercase letters and numbers, for example ENG, PROD)",
      name: "spaceKey",
      required: true,
      type: "string",
    },
    {
      description: "Display name for the new space",
      name: "name",
      required: true,
      type: "string",
    },
    {
      description: "Optional plain-text description for the space",
      name: "description",
      required: false,
      type: "string",
    },
    {
      description:
        "Create a private space visible only to the creator (default false)",
      name: "isPrivate",
      required: false,
      type: "boolean",
    },
  ],
  confluenceMovePage: [
    PAGE_ID_PARAM,
    PAGE_TITLE_PARAM,
    SPACE_KEY_PARAM,
    {
      description: "Destination parent page ID or URL",
      name: "parentPageId",
      required: false,
      type: "string",
    },
    {
      description:
        "Destination parent page title when parentPageId is unknown. Uses spaceKey to narrow search.",
      name: "parentPageTitle",
      required: false,
      type: "string",
    },
  ],
  confluenceRenamePage: [
    PAGE_ID_PARAM,
    PAGE_TITLE_PARAM,
    SPACE_KEY_PARAM,
    {
      description: "New page title",
      name: "title",
      required: true,
      type: "string",
    },
  ],
  confluenceUpdatePage: [
    PAGE_ID_PARAM,
    PAGE_TITLE_PARAM,
    SPACE_KEY_PARAM,
    {
      description: "Page body plain text to append or replace",
      name: "content",
      required: true,
      type: "string",
    },
    {
      description:
        'How to apply content: "append" (default) adds to the end; "replace" overwrites the entire body',
      name: "contentMode",
      required: false,
      type: "string",
    },
  ],
};
