import type { Provider } from "@/core/lib/connectors/providers/types";

export const CONFLUENCE_PROVIDER_ID = "confluence-cloud";

export const confluenceProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Productivity",
  description:
    "Connect your Confluence Cloud account to sync sources and create spaces, pages, and updates from chat.",
  iconColor: "bg-indigo-500",
  id: CONFLUENCE_PROVIDER_ID,
  name: "Confluence",
  scopes: [],
  tools: [
    {
      description:
        "Create a new Confluence space by key and name. Use before creating pages in a new space.",
      id: "confluenceCreateSpace",
      name: "Create Confluence space",
    },
    {
      description:
        "Create a page in a space. Use parentPageId or parentPageTitle to nest under an existing page.",
      id: "confluenceCreatePage",
      name: "Create Confluence page",
    },
    {
      description:
        "Rename a Confluence page title only. Pass pageId or pageTitle for the current title.",
      id: "confluenceRenamePage",
      name: "Rename Confluence page",
    },
    {
      description:
        "Append or replace Confluence page body content. Default contentMode is append. Use confluenceRenamePage to change the title.",
      id: "confluenceUpdatePage",
      name: "Update Confluence page",
    },
    {
      description:
        "Move a page under a new parent using parentPageId or parentPageTitle.",
      id: "confluenceMovePage",
      name: "Move Confluence page",
    },
  ],
};
