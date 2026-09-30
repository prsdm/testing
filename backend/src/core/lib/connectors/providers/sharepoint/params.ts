import type { ToolParam } from "@/core/lib/connectors/providers/types";

const SITE_ID_PARAM: ToolParam = {
  description: "SharePoint site ID from a prior tool result or admin config",
  name: "siteId",
  required: false,
  type: "string",
};

const SITE_URL_PARAM: ToolParam = {
  description:
    "SharePoint site URL (for example https://contoso.sharepoint.com/sites/Engineering)",
  name: "siteUrl",
  required: false,
  type: "string",
};

const SITE_NAME_PARAM: ToolParam = {
  description:
    "SharePoint site name when siteId/siteUrl are unknown. Used to search for the site.",
  name: "siteName",
  required: false,
  type: "string",
};

const PAGE_ID_PARAM: ToolParam = {
  description:
    "SharePoint page ID from a prior tool result, a siteId::pageId external ref, or a page URL",
  name: "pageId",
  required: false,
  type: "string",
};

const PAGE_TITLE_PARAM: ToolParam = {
  description:
    "Page title when pageId is unknown. Resolved within the target site.",
  name: "pageTitle",
  required: false,
  type: "string",
};

const SITE_PARAMS = [SITE_ID_PARAM, SITE_URL_PARAM, SITE_NAME_PARAM];

export const SHAREPOINT_PARAMS: Record<string, ToolParam[]> = {
  sharePointCreatePage: [
    ...SITE_PARAMS.map((param) =>
      param.name === "siteName"
        ? {
            ...param,
            description:
              "SharePoint site name. Provide siteId, siteUrl, or siteName.",
            required: false,
          }
        : param
    ),
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
  ],
  sharePointRenamePage: [
    ...SITE_PARAMS,
    PAGE_ID_PARAM,
    PAGE_TITLE_PARAM,
    {
      description: "New page title",
      name: "title",
      required: true,
      type: "string",
    },
  ],
  sharePointUpdatePage: [
    ...SITE_PARAMS,
    PAGE_ID_PARAM,
    PAGE_TITLE_PARAM,
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
