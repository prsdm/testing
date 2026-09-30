import { and, eq, inArray } from "drizzle-orm";
import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import { JIRA_PROVIDER_ID } from "@/core/lib/connectors/providers/jira/provider";
import { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import { SLACK_PROVIDER_ID } from "@/core/lib/connectors/providers/slack/provider";
import { getDb } from "@/core/lib/db/client";
import {
  authUser,
  connectorAccess,
  connectors,
  credentials,
  tenantMembers,
  tenantPeople,
  toolConfigs,
} from "@/core/lib/db/tables";
import type { IntegrationConnectionListItem } from "@/core/lib/integrations/integration-connection-types";
import { GOOGLE_DRIVE_PROVIDER_ID } from "@/shared/connectors/providers/google-drive/provider";
import {
  GOOGLE_PROVIDER_IDS,
  getGoogleWorkspaceApp,
} from "@/shared/connectors/providers/google-shared/apps";
import {
  getIntegrationCatalogEntry,
  INTEGRATION_CATALOG,
  INTEGRATION_KEYS,
  type IntegrationKey,
} from "@/shared/integrations/integration-catalog";
import { getUserDisplayName } from "@/shared/user-display";

const db = getDb();

const LEGACY_UNIFIED_CONNECTION_NAME = "Google Drive";

const CREDENTIAL_PROVIDER_BY_KEY: Record<
  Exclude<IntegrationKey, `google-${string}` | "gmail">,
  string
> = {
  confluence: CONFLUENCE_PROVIDER_ID,
  jira: JIRA_PROVIDER_ID,
  notion: NOTION_PROVIDER_ID,
  sharepoint: SHAREPOINT_PROVIDER_ID,
  slack: SLACK_PROVIDER_ID,
};

const CONNECTION_NAME_BY_KEY: Record<
  Exclude<IntegrationKey, `google-${string}` | "gmail">,
  string
> = {
  confluence: "Confluence",
  jira: "Jira",
  notion: "Notion",
  sharepoint: "SharePoint",
  slack: "Slack",
};

type UserConnection = {
  connectorId: string;
  connectionName: string;
};

type TenantConnectionContext = {
  connectionsByUser: Map<string, UserConnection[]>;
  credentialsByUser: Map<string, Set<string>>;
  legacyProvidersByConnector: Map<string, Set<string>>;
};

export type { IntegrationConnectionListItem } from "@/core/lib/integrations/integration-connection-types";

async function loadTenantConnectionContext(
  tenantId: string
): Promise<TenantConnectionContext> {
  const [connectionRows, credentialRows, legacyToolRows] = await Promise.all([
    db
      .select({
        connectionName: connectors.name,
        connectorId: connectors.id,
        userId: connectorAccess.userId,
      })
      .from(connectors)
      .innerJoin(
        connectorAccess,
        eq(connectorAccess.connectorId, connectors.id)
      )
      .where(
        and(eq(connectors.tenantId, tenantId), eq(connectors.status, "active"))
      ),
    db
      .select({
        provider: credentials.provider,
        userId: credentials.ownedByUserId,
      })
      .from(credentials)
      .where(
        and(eq(credentials.tenantId, tenantId), eq(credentials.enabled, true))
      ),
    db
      .select({
        connectorId: toolConfigs.connectorId,
        providerId: toolConfigs.providerId,
      })
      .from(toolConfigs)
      .where(
        and(
          eq(toolConfigs.tenantId, tenantId),
          inArray(toolConfigs.providerId, GOOGLE_PROVIDER_IDS)
        )
      ),
  ]);

  const credentialsByUser = new Map<string, Set<string>>();
  for (const row of credentialRows) {
    if (!row.userId || !row.provider) {
      continue;
    }
    const existing = credentialsByUser.get(row.userId) ?? new Set<string>();
    existing.add(row.provider);
    credentialsByUser.set(row.userId, existing);
  }

  const connectionsByUser = new Map<string, UserConnection[]>();
  for (const row of connectionRows) {
    const existing = connectionsByUser.get(row.userId) ?? [];
    existing.push({
      connectionName: row.connectionName,
      connectorId: row.connectorId,
    });
    connectionsByUser.set(row.userId, existing);
  }

  const legacyProvidersByConnector = new Map<string, Set<string>>();
  for (const row of legacyToolRows) {
    if (!row.connectorId) {
      continue;
    }
    const existing =
      legacyProvidersByConnector.get(row.connectorId) ?? new Set<string>();
    existing.add(row.providerId);
    legacyProvidersByConnector.set(row.connectorId, existing);
  }

  return {
    connectionsByUser,
    credentialsByUser,
    legacyProvidersByConnector,
  };
}

function userIsConnectedToIntegration(
  userId: string,
  integrationKey: IntegrationKey,
  context: TenantConnectionContext
) {
  const entry = getIntegrationCatalogEntry(integrationKey);
  if (!entry) {
    return false;
  }

  const userConnections = context.connectionsByUser.get(userId) ?? [];
  const userCredentials = context.credentialsByUser.get(userId);

  if (entry.googleAppId) {
    const app = getGoogleWorkspaceApp(entry.googleAppId);
    if (!app) {
      return false;
    }
    if (!userCredentials?.has(GOOGLE_DRIVE_PROVIDER_ID)) {
      return false;
    }
    return userHasGoogleAppConnection({
      connectionName: app.connectionName,
      legacyProvidersByConnector: context.legacyProvidersByConnector,
      providerId: app.providerId,
      userConnections,
    });
  }

  const credentialProvider =
    CREDENTIAL_PROVIDER_BY_KEY[
      integrationKey as Exclude<IntegrationKey, `google-${string}` | "gmail">
    ];
  const connectionName =
    CONNECTION_NAME_BY_KEY[
      integrationKey as Exclude<IntegrationKey, `google-${string}` | "gmail">
    ];
  if (!userCredentials?.has(credentialProvider)) {
    return false;
  }
  return userConnections.some(
    (connection) => connection.connectionName === connectionName
  );
}

function userHasGoogleAppConnection(args: {
  userConnections: UserConnection[];
  connectionName: string;
  providerId: string;
  legacyProvidersByConnector: Map<string, Set<string>>;
}) {
  return args.userConnections.some((connection) => {
    if (connection.connectionName === args.connectionName) {
      return true;
    }
    if (connection.connectionName !== LEGACY_UNIFIED_CONNECTION_NAME) {
      return false;
    }
    return (
      args.legacyProvidersByConnector
        .get(connection.connectorId)
        ?.has(args.providerId) ?? false
    );
  });
}

export async function countIntegrationConnectionsForTenant(
  tenantId: string
): Promise<Map<IntegrationKey, number>> {
  const counts = new Map<IntegrationKey, number>(
    INTEGRATION_KEYS.map((key) => [key, 0])
  );

  const context = await loadTenantConnectionContext(tenantId);

  for (const entry of INTEGRATION_CATALOG) {
    let count = 0;
    for (const userId of context.connectionsByUser.keys()) {
      if (userIsConnectedToIntegration(userId, entry.key, context)) {
        count += 1;
      }
    }
    counts.set(entry.key, count);
  }

  return counts;
}

export async function listIntegrationConnectionsForIntegration(
  tenantId: string,
  integrationKey: IntegrationKey
): Promise<IntegrationConnectionListItem[]> {
  const context = await loadTenantConnectionContext(tenantId);
  const connectedUserIds = [...context.connectionsByUser.keys()].filter(
    (userId) => userIsConnectedToIntegration(userId, integrationKey, context)
  );

  if (connectedUserIds.length === 0) {
    return [];
  }

  const memberRows = await db
    .select({
      authUserId: tenantMembers.authUserId,
      displayName: tenantPeople.displayName,
      email: tenantMembers.email,
      firstName: tenantPeople.firstName,
      image: authUser.image,
      lastName: tenantPeople.lastName,
      userName: authUser.name,
    })
    .from(tenantMembers)
    .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
    .leftJoin(tenantPeople, eq(tenantMembers.personId, tenantPeople.id))
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        inArray(tenantMembers.authUserId, connectedUserIds)
      )
    );

  const byAuthUserId = new Map(
    memberRows.map((row) => [row.authUserId, row] as const)
  );

  return connectedUserIds.map((authUserId) => {
    const row = byAuthUserId.get(authUserId);
    const email = row?.email ?? "";
    const displayName =
      row?.displayName?.trim() ||
      `${row?.firstName ?? ""} ${row?.lastName ?? ""}`.trim() ||
      getUserDisplayName({ email, name: row?.userName });

    return {
      authUserId,
      displayName,
      email,
      image: row?.image ?? null,
    };
  });
}

function connectionNameForIntegrationKey(
  integrationKey: IntegrationKey
): string | null {
  const entry = getIntegrationCatalogEntry(integrationKey);
  if (!entry) {
    return null;
  }
  if (entry.googleAppId) {
    return getGoogleWorkspaceApp(entry.googleAppId)?.connectionName ?? null;
  }
  return (
    CONNECTION_NAME_BY_KEY[
      integrationKey as Exclude<IntegrationKey, `google-${string}` | "gmail">
    ] ?? null
  );
}

function credentialProviderForIntegrationKey(
  integrationKey: IntegrationKey
): string | null {
  const entry = getIntegrationCatalogEntry(integrationKey);
  if (!entry) {
    return null;
  }
  if (entry.googleAppId) {
    // Google apps share the Drive OAuth credential row.
    return GOOGLE_DRIVE_PROVIDER_ID;
  }
  return (
    CREDENTIAL_PROVIDER_BY_KEY[
      integrationKey as Exclude<IntegrationKey, `google-${string}` | "gmail">
    ] ?? null
  );
}

/**
 * Remove all user connectors for an integration so members must reconnect
 * after the admin sets it up again.
 */
export async function deleteIntegrationConnectionsForTenant(
  tenantId: string,
  integrationKey: IntegrationKey
) {
  const connectionName = connectionNameForIntegrationKey(integrationKey);
  const credentialProvider =
    credentialProviderForIntegrationKey(integrationKey);
  if (!(connectionName && credentialProvider)) {
    return;
  }

  const rows = await db
    .select({
      connectorId: connectors.id,
      credentialId: credentials.id,
    })
    .from(connectors)
    .innerJoin(toolConfigs, eq(toolConfigs.connectorId, connectors.id))
    .innerJoin(credentials, eq(credentials.id, toolConfigs.credentialId))
    .where(
      and(
        eq(connectors.tenantId, tenantId),
        eq(connectors.name, connectionName),
        eq(credentials.provider, credentialProvider)
      )
    );

  if (rows.length === 0) {
    return;
  }

  const connectorIds = [...new Set(rows.map((row) => row.connectorId))];
  const credentialIds = [...new Set(rows.map((row) => row.credentialId))];

  await db
    .delete(connectors)
    .where(
      and(
        eq(connectors.tenantId, tenantId),
        inArray(connectors.id, connectorIds)
      )
    );

  // Google OAuth credentials are shared across apps — only delete when this
  // connector was the last consumer of that credential.
  if (integrationKey.startsWith("google-") || integrationKey === "gmail") {
    for (const credentialId of credentialIds) {
      const [stillUsed] = await db
        .select({ connectorId: toolConfigs.connectorId })
        .from(toolConfigs)
        .where(eq(toolConfigs.credentialId, credentialId))
        .limit(1);
      if (stillUsed) {
        continue;
      }
      await db
        .delete(credentials)
        .where(
          and(
            eq(credentials.id, credentialId),
            eq(credentials.tenantId, tenantId)
          )
        );
    }
    return;
  }

  await db
    .delete(credentials)
    .where(
      and(
        eq(credentials.tenantId, tenantId),
        inArray(credentials.id, credentialIds)
      )
    );
}
