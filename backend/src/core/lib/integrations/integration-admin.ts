import { and, eq } from "drizzle-orm";
import { getConfluenceOAuthRedirectUri } from "@/core/lib/connectors/providers/confluence/oauth";
import { getGoogleDriveOAuthRedirectUri } from "@/core/lib/connectors/providers/google-drive/oauth";
import { deleteGoogleAppConnectorForTenantUser } from "@/core/lib/connectors/providers/google-shared/queries";
import { getJiraOAuthRedirectUri } from "@/core/lib/connectors/providers/jira/oauth";
import { getSharePointOAuthRedirectUri } from "@/core/lib/connectors/providers/sharepoint/oauth";
import { getSlackOAuthRedirectUri } from "@/core/lib/connectors/providers/slack/oauth";
import { getDb } from "@/core/lib/db/client";
import {
  getTenantConfluenceActionsConfig,
  updateTenantConfluenceActionsSettings,
} from "@/core/lib/db/confluence-actions-queries";
import {
  deleteConfluenceConnectorForTenantUser,
  deleteJiraConnectorForTenantUser,
  deleteNotionConnectorForTenantUser,
  deleteSharePointConnectorForTenantUser,
  deleteSlackConnectorForTenantUser,
} from "@/core/lib/db/connector-queries";
import {
  getTenantDriveActionsConfig,
  updateTenantDriveActionsSettings,
} from "@/core/lib/db/drive-actions-queries";
import {
  disableIntegrationAvailability,
  getIntegrationAvailability,
  type IntegrationAvailabilityMode,
  listIntegrationAvailabilityForTenant,
  saveIntegrationAvailability,
} from "@/core/lib/db/integration-availability-queries";
import {
  countIntegrationConnectionsForTenant,
  deleteIntegrationConnectionsForTenant,
  listIntegrationConnectionsForIntegration,
} from "@/core/lib/db/integration-connection-count-queries";
import {
  getTenantJiraActionsConfig,
  updateTenantJiraActionsSettings,
} from "@/core/lib/db/jira-actions-queries";
import {
  getTenantNotionActionsConfig,
  updateTenantNotionActionsSettings,
} from "@/core/lib/db/notion-actions-queries";
import {
  getTenantSharePointActionsConfig,
  updateTenantSharePointActionsSettings,
} from "@/core/lib/db/sharepoint-actions-queries";
import {
  getTenantSlackActionsConfig,
  updateTenantSlackActionsSettings,
} from "@/core/lib/db/slack-actions-queries";
import {
  tenantConfluenceActionsSettings,
  tenantDriveActionsSettings,
  tenantJiraActionsSettings,
  tenantMembers,
  tenantNotionActionsSettings,
  tenantSharePointActionsSettings,
  tenantSlackActionsSettings,
} from "@/core/lib/db/tables";
import {
  isConfluenceIntegrationReady,
  isDriveOAuthConfigured,
  isJiraIntegrationReady,
  isNotionOAuthConfigured,
  isSharePointOAuthConfigured,
  isSlackOAuthConfigured,
} from "@/core/lib/integrations/integration-readiness";
import { ChatbotError } from "@/shared/errors";
import {
  getIntegrationCatalogEntry,
  INTEGRATION_CATALOG,
  type IntegrationCatalogEntry,
  type IntegrationCredentialFamily,
  type IntegrationKey,
} from "@/shared/integrations/integration-catalog";

export type IntegrationCredentialsView = {
  credentialMode: "managed" | "own";
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
  siteUrl: string | null;
  redirectUri: string | null;
  credentialsReady: boolean;
};

export type IntegrationAdminRow = {
  key: IntegrationKey;
  name: string;
  provider: IntegrationCatalogEntry["provider"];
  isEnabled: boolean;
  statusLabel: "On" | "Off";
  credentialsLabel: "Kimiro" | "Your own";
  availabilityLabel: string;
  availabilityMode: IntegrationAvailabilityMode;
  memberIds: string[];
  connectionsCount: number;
  connectionsLabel: string;
  credentials: IntegrationCredentialsView;
};

function redirectUriForFamily(family: IntegrationCredentialFamily) {
  switch (family) {
    case "google":
      return getGoogleDriveOAuthRedirectUri();
    case "confluence":
      return getConfluenceOAuthRedirectUri();
    case "jira":
      return getJiraOAuthRedirectUri();
    case "sharepoint":
      return getSharePointOAuthRedirectUri();
    case "slack":
      return getSlackOAuthRedirectUri();
    default:
      return null;
  }
}

async function loadCredentialsForFamily(
  tenantId: string,
  family: IntegrationCredentialFamily
): Promise<IntegrationCredentialsView> {
  const redirectUri = redirectUriForFamily(family);

  switch (family) {
    case "google": {
      const config = await getTenantDriveActionsConfig(tenantId);
      return {
        credentialMode: config.credentialMode,
        credentialsReady: isDriveOAuthConfigured(config),
        hasOAuthClientSecret: config.hasOAuthClientSecret,
        oauthClientId: config.oauthClientId,
        redirectUri,
        siteUrl: null,
      };
    }
    case "confluence": {
      const config = await getTenantConfluenceActionsConfig(tenantId);
      return {
        credentialMode: config.credentialMode,
        credentialsReady: isConfluenceIntegrationReady(config),
        hasOAuthClientSecret: config.hasOAuthClientSecret,
        oauthClientId: config.oauthClientId,
        redirectUri,
        siteUrl: config.siteUrl,
      };
    }
    case "notion": {
      const config = await getTenantNotionActionsConfig(tenantId);
      return {
        credentialMode: config.credentialMode,
        credentialsReady: isNotionOAuthConfigured(config),
        hasOAuthClientSecret: config.hasOAuthClientSecret,
        oauthClientId: config.oauthClientId,
        redirectUri: null,
        siteUrl: null,
      };
    }
    case "sharepoint": {
      const config = await getTenantSharePointActionsConfig(tenantId);
      return {
        credentialMode: config.credentialMode,
        credentialsReady: isSharePointOAuthConfigured(config),
        hasOAuthClientSecret: config.hasOAuthClientSecret,
        oauthClientId: config.oauthClientId,
        redirectUri,
        siteUrl: null,
      };
    }
    case "slack": {
      const config = await getTenantSlackActionsConfig(tenantId);
      return {
        credentialMode: config.credentialMode,
        credentialsReady: isSlackOAuthConfigured(config),
        hasOAuthClientSecret: config.hasOAuthClientSecret,
        oauthClientId: config.oauthClientId,
        redirectUri,
        siteUrl: null,
      };
    }
    case "jira": {
      const config = await getTenantJiraActionsConfig(tenantId);
      return {
        credentialMode: config.credentialMode,
        credentialsReady: isJiraIntegrationReady(config),
        hasOAuthClientSecret: config.hasOAuthClientSecret,
        oauthClientId: config.oauthClientId,
        redirectUri,
        siteUrl: config.siteUrl,
      };
    }
    default:
      return {
        credentialMode: "managed",
        credentialsReady: false,
        hasOAuthClientSecret: false,
        oauthClientId: null,
        redirectUri: null,
        siteUrl: null,
      };
  }
}

function availabilityLabel(args: {
  isEnabled: boolean;
  availabilityMode: IntegrationAvailabilityMode;
  memberCount: number;
}) {
  if (!args.isEnabled) {
    return "Not available";
  }
  if (args.availabilityMode === "everyone") {
    return "Everyone";
  }
  if (args.memberCount === 1) {
    return "1 person";
  }
  return `${args.memberCount} people`;
}

function credentialsLabel(
  credentialMode: IntegrationCredentialsView["credentialMode"]
): IntegrationAdminRow["credentialsLabel"] {
  return credentialMode === "managed" ? "Kimiro" : "Your own";
}

function connectionsLabel(count: number) {
  if (count === 0) {
    return "0";
  }
  if (count === 1) {
    return "1 person";
  }
  return `${count} people`;
}

export async function getTenantIntegrationsAdminView(tenantId: string) {
  const [availabilityByKey, connectionCounts] = await Promise.all([
    listIntegrationAvailabilityForTenant(tenantId),
    countIntegrationConnectionsForTenant(tenantId),
  ]);
  const credentialCache = new Map<
    IntegrationCredentialFamily,
    IntegrationCredentialsView
  >();

  const rows: IntegrationAdminRow[] = [];
  for (const entry of INTEGRATION_CATALOG) {
    let credentials = credentialCache.get(entry.credentialFamily);
    if (!credentials) {
      credentials = await loadCredentialsForFamily(
        tenantId,
        entry.credentialFamily
      );
      credentialCache.set(entry.credentialFamily, credentials);
    }

    const availability = availabilityByKey.get(entry.key) ?? {
      availabilityMode: "everyone" as const,
      isEnabled: false,
      memberIds: [],
    };

    const connectionsCount = connectionCounts.get(entry.key) ?? 0;

    rows.push({
      availabilityLabel: availabilityLabel({
        availabilityMode: availability.availabilityMode,
        isEnabled: availability.isEnabled,
        memberCount: availability.memberIds.length,
      }),
      availabilityMode: availability.availabilityMode,
      connectionsCount,
      connectionsLabel: connectionsLabel(connectionsCount),
      credentials,
      credentialsLabel: credentialsLabel(credentials.credentialMode),
      isEnabled: availability.isEnabled,
      key: entry.key,
      memberIds: availability.memberIds,
      name: entry.name,
      provider: entry.provider,
      statusLabel: availability.isEnabled ? "On" : "Off",
    });
  }

  return rows;
}

export function getIntegrationConnectionsForAdmin(
  tenantId: string,
  integrationKey: IntegrationKey
) {
  return listIntegrationConnectionsForIntegration(tenantId, integrationKey);
}

export async function removeIntegrationConnectionForUser(
  tenantId: string,
  integrationKey: IntegrationKey,
  authUserId: string
) {
  const entry = getIntegrationCatalogEntry(integrationKey);
  if (!entry) {
    throw new ChatbotError("bad_request:api", "Unknown integration.");
  }

  switch (integrationKey) {
    case "confluence":
      await deleteConfluenceConnectorForTenantUser({
        tenantId,
        userId: authUserId,
      });
      return;
    case "jira":
      await deleteJiraConnectorForTenantUser({ tenantId, userId: authUserId });
      return;
    case "notion":
      await deleteNotionConnectorForTenantUser({
        tenantId,
        userId: authUserId,
      });
      return;
    case "sharepoint":
      await deleteSharePointConnectorForTenantUser({
        tenantId,
        userId: authUserId,
      });
      return;
    case "slack":
      await deleteSlackConnectorForTenantUser({ tenantId, userId: authUserId });
      return;
    case "google-drive":
    case "gmail":
    case "google-calendar": {
      if (!entry.googleAppId) {
        throw new ChatbotError("bad_request:api", "Unknown integration.");
      }
      await deleteGoogleAppConnectorForTenantUser({
        appId: entry.googleAppId,
        tenantId,
        userId: authUserId,
      });
      return;
    }
    default:
      throw new ChatbotError("bad_request:api", "Unknown integration.");
  }
}

export async function getIntegrationAdminDetail(
  tenantId: string,
  integrationKey: IntegrationKey
) {
  const entry = getIntegrationCatalogEntry(integrationKey);
  if (!entry) {
    return null;
  }

  const [credentials, availability] = await Promise.all([
    loadCredentialsForFamily(tenantId, entry.credentialFamily),
    getIntegrationAvailability(tenantId, integrationKey),
  ]);

  return {
    availability,
    credentials,
    key: entry.key,
    name: entry.name,
    provider: entry.provider,
    requiresSiteUrl: entry.requiresSiteUrl,
  };
}

export type SaveIntegrationSetupInput = {
  credentialMode: "managed" | "own";
  oauthClientId?: string;
  oauthClientSecret?: string;
  siteUrl?: string;
  availabilityMode: IntegrationAvailabilityMode;
  memberIds: string[];
};

export function validateIntegrationCredentialsInput(args: {
  entry: NonNullable<ReturnType<typeof getIntegrationCatalogEntry>>;
  credentials: IntegrationCredentialsView;
  input: SaveIntegrationSetupInput;
}) {
  if (args.entry.requiresSiteUrl && !args.input.siteUrl?.trim()) {
    throw new ChatbotError("bad_request:api", "Site URL is required.");
  }

  if (args.input.credentialMode === "own") {
    const clientId = args.input.oauthClientId?.trim();
    const hasSecret =
      Boolean(args.input.oauthClientSecret?.trim()) ||
      args.credentials.hasOAuthClientSecret;
    if (!clientId || !hasSecret) {
      throw new ChatbotError(
        "bad_request:api",
        "OAuth client ID and secret are required for your own credentials."
      );
    }
  }
}

export async function saveIntegrationSetup(
  tenantId: string,
  integrationKey: IntegrationKey,
  input: SaveIntegrationSetupInput
) {
  const entry = getIntegrationCatalogEntry(integrationKey);
  if (!entry) {
    throw new ChatbotError("bad_request:api", "Unknown integration.");
  }

  const credentials = await loadCredentialsForFamily(
    tenantId,
    entry.credentialFamily
  );
  validateIntegrationCredentialsInput({ credentials, entry, input });

  const credentialPatch = {
    credentialMode: input.credentialMode,
    ...(input.credentialMode === "own" && input.oauthClientId
      ? { oauthClientId: input.oauthClientId.trim() }
      : {}),
    ...(input.oauthClientSecret?.trim()
      ? { oauthClientSecret: input.oauthClientSecret.trim() }
      : {}),
    ...(entry.requiresSiteUrl && input.siteUrl
      ? { siteUrl: input.siteUrl.trim() }
      : {}),
    allowRead: true,
  };

  switch (entry.credentialFamily) {
    case "google":
      await updateTenantDriveActionsSettings(tenantId, credentialPatch);
      break;
    case "confluence":
      await updateTenantConfluenceActionsSettings(tenantId, credentialPatch);
      break;
    case "notion":
      await updateTenantNotionActionsSettings(tenantId, credentialPatch);
      break;
    case "sharepoint":
      await updateTenantSharePointActionsSettings(tenantId, credentialPatch);
      break;
    case "slack":
      await updateTenantSlackActionsSettings(tenantId, credentialPatch);
      break;
    case "jira":
      await updateTenantJiraActionsSettings(tenantId, credentialPatch);
      break;
    default:
      break;
  }

  await saveIntegrationAvailability({
    availabilityMode: input.availabilityMode,
    integrationKey,
    memberIds: input.memberIds,
    tenantId,
  });
}

async function clearCredentialFamilySettings(
  tenantId: string,
  family: IntegrationCredentialFamily
) {
  const db = getDb();
  const clearedAt = new Date();
  const oauthReset = {
    credentialMode: "managed" as const,
    oauthClientId: null,
    oauthClientSecretEncrypted: null,
    updatedAt: clearedAt,
  };

  switch (family) {
    case "google":
      await db
        .update(tenantDriveActionsSettings)
        .set(oauthReset)
        .where(eq(tenantDriveActionsSettings.tenantId, tenantId));
      break;
    case "confluence":
      await db
        .update(tenantConfluenceActionsSettings)
        .set({ ...oauthReset, siteUrl: null })
        .where(eq(tenantConfluenceActionsSettings.tenantId, tenantId));
      break;
    case "notion":
      await db
        .update(tenantNotionActionsSettings)
        .set(oauthReset)
        .where(eq(tenantNotionActionsSettings.tenantId, tenantId));
      break;
    case "sharepoint":
      await db
        .update(tenantSharePointActionsSettings)
        .set(oauthReset)
        .where(eq(tenantSharePointActionsSettings.tenantId, tenantId));
      break;
    case "slack":
      await db
        .update(tenantSlackActionsSettings)
        .set(oauthReset)
        .where(eq(tenantSlackActionsSettings.tenantId, tenantId));
      break;
    case "jira":
      await db
        .update(tenantJiraActionsSettings)
        .set({ ...oauthReset, siteUrl: null })
        .where(eq(tenantJiraActionsSettings.tenantId, tenantId));
      break;
    default:
      break;
  }
}

/**
 * Remove an integration: disable it, clear admin setup when safe, and drop
 * user connections so the next enable starts from scratch.
 */
export async function removeIntegrationSetup(
  tenantId: string,
  integrationKey: IntegrationKey
) {
  const entry = getIntegrationCatalogEntry(integrationKey);
  if (!entry) {
    throw new ChatbotError("bad_request:api", "Unknown integration.");
  }

  await disableIntegrationAvailability({ integrationKey, tenantId });
  await deleteIntegrationConnectionsForTenant(tenantId, integrationKey);

  const availabilityByKey =
    await listIntegrationAvailabilityForTenant(tenantId);
  const siblingStillEnabled = INTEGRATION_CATALOG.some(
    (catalogEntry) =>
      catalogEntry.credentialFamily === entry.credentialFamily &&
      catalogEntry.key !== integrationKey &&
      (availabilityByKey.get(catalogEntry.key)?.isEnabled ?? false)
  );

  if (!siblingStillEnabled) {
    await clearCredentialFamilySettings(tenantId, entry.credentialFamily);
  }
}

export async function getTenantMemberIdForAuthUser(args: {
  tenantId: string;
  authUserId: string;
}) {
  const db = getDb();
  const [member] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.authUserId)
      )
    )
    .limit(1);
  return member?.id ?? null;
}

export async function isIntegrationAvailableToAuthUser(args: {
  tenantId: string;
  authUserId: string;
  integrationKey: IntegrationKey;
}) {
  const memberId = await getTenantMemberIdForAuthUser({
    authUserId: args.authUserId,
    tenantId: args.tenantId,
  });
  if (!memberId) {
    return false;
  }

  const availability = await getIntegrationAvailability(
    args.tenantId,
    args.integrationKey
  );
  if (!availability.isEnabled) {
    return false;
  }
  if (availability.availabilityMode === "everyone") {
    return true;
  }
  return availability.memberIds.includes(memberId);
}
