import type { ConnectorProvider } from "@/contracts/connectors";
import type { GoogleAppId } from "@/shared/connectors/providers/google-shared/apps";

export type IntegrationKey =
  | "confluence"
  | "gmail"
  | "google-calendar"
  | "google-drive"
  | "jira"
  | "notion"
  | "sharepoint"
  | "slack";

export type IntegrationCredentialFamily =
  | "google"
  | "confluence"
  | "notion"
  | "sharepoint"
  | "slack"
  | "jira";

export type IntegrationCatalogEntry = {
  key: IntegrationKey;
  name: string;
  description: string;
  provider: ConnectorProvider;
  credentialFamily: IntegrationCredentialFamily;
  googleAppId?: GoogleAppId;
  requiresSiteUrl: boolean;
};

/** Sorted alphabetically by display name. */
export const INTEGRATION_CATALOG: IntegrationCatalogEntry[] = [
  {
    credentialFamily: "confluence",
    description: "Search and read pages across your Confluence spaces.",
    key: "confluence",
    name: "Confluence",
    provider: "confluence",
    requiresSiteUrl: true,
  },
  {
    credentialFamily: "google",
    description: "Search messages and threads in connected inboxes.",
    googleAppId: "gmail",
    key: "gmail",
    name: "Gmail",
    provider: "gmail",
    requiresSiteUrl: false,
  },
  {
    credentialFamily: "google",
    description: "View and search events across connected calendars.",
    googleAppId: "google-calendar",
    key: "google-calendar",
    name: "Google Calendar",
    provider: "google-calendar",
    requiresSiteUrl: false,
  },
  {
    credentialFamily: "google",
    description: "Find, download, and upload files across your drives.",
    googleAppId: "google-drive",
    key: "google-drive",
    name: "Google Drive",
    provider: "google-drive",
    requiresSiteUrl: false,
  },
  {
    credentialFamily: "jira",
    description: "Search issues and track work across your Jira projects.",
    key: "jira",
    name: "Jira",
    provider: "jira",
    requiresSiteUrl: true,
  },
  {
    credentialFamily: "notion",
    description: "Search pages and databases from connected Notion workspaces.",
    key: "notion",
    name: "Notion",
    provider: "notion",
    requiresSiteUrl: false,
  },
  {
    credentialFamily: "sharepoint",
    description: "Browse and search files across SharePoint sites.",
    key: "sharepoint",
    name: "Microsoft SharePoint",
    provider: "sharepoint",
    requiresSiteUrl: false,
  },
  {
    credentialFamily: "slack",
    description: "Search messages and channels in connected Slack workspaces.",
    key: "slack",
    name: "Slack",
    provider: "slack",
    requiresSiteUrl: false,
  },
];

export const INTEGRATION_KEYS = INTEGRATION_CATALOG.map(
  (entry) => entry.key
) as IntegrationKey[];

const catalogByKey = new Map(
  INTEGRATION_CATALOG.map((entry) => [entry.key, entry])
);

export function compareIntegrationDisplayNames(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

export function getIntegrationCatalogEntry(
  key: string
): IntegrationCatalogEntry | null {
  return catalogByKey.get(key as IntegrationKey) ?? null;
}

export function isIntegrationKey(key: string): key is IntegrationKey {
  return catalogByKey.has(key as IntegrationKey);
}

export function integrationKeyForGoogleApp(
  appId: GoogleAppId
): IntegrationKey | null {
  const entry = INTEGRATION_CATALOG.find((item) => item.googleAppId === appId);
  return entry?.key ?? null;
}
