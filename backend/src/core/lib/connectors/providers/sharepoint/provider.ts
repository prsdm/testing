import type { Provider } from "@/core/lib/connectors/providers/types";
import { DEFAULT_SHAREPOINT_OAUTH_SCOPES } from "./scopes";

export const SHAREPOINT_PROVIDER_ID = "sharepoint";

export const sharePointProvider: Provider = {
  auth: ["OAUTH2"],
  authType: "OAUTH2",
  category: "Productivity",
  description:
    "Connect your SharePoint account to sync sources and create or update site pages from chat.",
  iconColor: "bg-sky-600",
  id: SHAREPOINT_PROVIDER_ID,
  name: "SharePoint",
  scopes: [...DEFAULT_SHAREPOINT_OAUTH_SCOPES],
  tools: [
    {
      description:
        "Create a site page in a SharePoint site. Provide siteId, siteUrl, or siteName to identify the site.",
      id: "sharePointCreatePage",
      name: "Create SharePoint page",
    },
    {
      description:
        "Rename a SharePoint site page title only. Pass pageId or pageTitle for the current title.",
      id: "sharePointRenamePage",
      name: "Rename SharePoint page",
    },
    {
      description:
        "Append or replace SharePoint page body content. Default contentMode is append. Use sharePointRenamePage to change the title.",
      id: "sharePointUpdatePage",
      name: "Update SharePoint page",
    },
  ],
};
