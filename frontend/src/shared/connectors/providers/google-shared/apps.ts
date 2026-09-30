import type { ConnectorProvider } from "@/contracts/connectors";
import { gmailToolIdsForConnector } from "@/shared/connectors/providers/gmail/chat-tools";
import { GMAIL_PROVIDER_ID } from "@/shared/connectors/providers/gmail/provider";
import { DEFAULT_GMAIL_OAUTH_SCOPES } from "@/shared/connectors/providers/gmail/scopes";
import { googleCalendarToolIdsForConnector } from "@/shared/connectors/providers/google-calendar/chat-tools";
import { GOOGLE_CALENDAR_PROVIDER_ID } from "@/shared/connectors/providers/google-calendar/provider";
import { DEFAULT_GOOGLE_CALENDAR_OAUTH_SCOPES } from "@/shared/connectors/providers/google-calendar/scopes";
import { googleDriveToolIdsForConnector } from "@/shared/connectors/providers/google-drive/chat-tools";
import { GOOGLE_DRIVE_PROVIDER_ID } from "@/shared/connectors/providers/google-drive/provider";
import { DEFAULT_GOOGLE_DRIVE_OAUTH_SCOPES } from "@/shared/connectors/providers/google-drive/scopes";

export const GOOGLE_OAUTH_EMAIL_SCOPE =
  "https://www.googleapis.com/auth/userinfo.email";

export type GoogleAppId = "google-drive" | "gmail" | "google-calendar";

export type GoogleWorkspaceApp = {
  id: GoogleAppId;
  connectionName: string;
  providerId: string;
  uiProvider: ConnectorProvider;
  connectedParam: string;
  connectLabel: string;
  description: string;
  oauthScopes: readonly string[];
  toolIds: () => string[];
};

export const GOOGLE_WORKSPACE_APPS: GoogleWorkspaceApp[] = [
  {
    connectedParam: "driveConnected",
    connectionName: "Google Drive",
    connectLabel: "Connect",
    description: "Search, read, and write files",
    id: "google-drive",
    oauthScopes: DEFAULT_GOOGLE_DRIVE_OAUTH_SCOPES,
    providerId: GOOGLE_DRIVE_PROVIDER_ID,
    toolIds: googleDriveToolIdsForConnector,
    uiProvider: "google-drive",
  },
  {
    connectedParam: "gmailConnected",
    connectionName: "Gmail",
    connectLabel: "Connect",
    description: "Search, send, and read email",
    id: "gmail",
    oauthScopes: DEFAULT_GMAIL_OAUTH_SCOPES,
    providerId: GMAIL_PROVIDER_ID,
    toolIds: gmailToolIdsForConnector,
    uiProvider: "gmail",
  },
  {
    connectedParam: "calendarConnected",
    connectionName: "Google Calendar",
    connectLabel: "Connect",
    description: "View and manage calendar events",
    id: "google-calendar",
    oauthScopes: DEFAULT_GOOGLE_CALENDAR_OAUTH_SCOPES,
    providerId: GOOGLE_CALENDAR_PROVIDER_ID,
    toolIds: googleCalendarToolIdsForConnector,
    uiProvider: "google-calendar",
  },
];

export const GOOGLE_APP_IDS = GOOGLE_WORKSPACE_APPS.map((app) => app.id);

export const GOOGLE_PROVIDER_IDS = GOOGLE_WORKSPACE_APPS.map(
  (app) => app.providerId
);

const appById = new Map(GOOGLE_WORKSPACE_APPS.map((app) => [app.id, app]));
const appByProviderId = new Map(
  GOOGLE_WORKSPACE_APPS.map((app) => [app.providerId, app])
);

export function getGoogleWorkspaceApp(
  appId: string
): GoogleWorkspaceApp | null {
  return appById.get(appId as GoogleAppId) ?? null;
}

export function getGoogleWorkspaceAppByProviderId(
  providerId: string
): GoogleWorkspaceApp | null {
  return appByProviderId.get(providerId) ?? null;
}

export function oauthScopesForGoogleApp(appId: GoogleAppId): string[] {
  const app = appById.get(appId);
  if (!app) {
    return [GOOGLE_OAUTH_EMAIL_SCOPE];
  }
  const merged = new Set<string>([
    ...app.oauthScopes,
    GOOGLE_OAUTH_EMAIL_SCOPE,
  ]);
  return [...merged];
}

/**
 * Full Workspace scope set. Shared credential means any app connect must keep
 * Drive+Gmail+Calendar grants or sibling surfaces break until another consent.
 */
export function oauthScopesForAllGoogleWorkspaceApps(): string[] {
  const merged = new Set<string>([GOOGLE_OAUTH_EMAIL_SCOPE]);
  for (const app of GOOGLE_WORKSPACE_APPS) {
    for (const scope of app.oauthScopes) {
      merged.add(scope);
    }
  }
  return [...merged];
}

export function mergeGoogleOAuthScopeStrings(
  ...scopeStrings: string[]
): string[] {
  const merged = new Set<string>();
  for (const scopeString of scopeStrings) {
    for (const scope of scopeString.split(/[,\s]+/)) {
      const trimmed = scope.trim();
      if (trimmed) {
        merged.add(trimmed);
      }
    }
  }
  return [...merged];
}
