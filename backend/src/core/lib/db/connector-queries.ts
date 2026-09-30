import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import { JIRA_PROVIDER_ID } from "@/core/lib/connectors/providers/jira/provider";
import { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import { SLACK_PROVIDER_ID } from "@/core/lib/connectors/providers/slack/provider";
import { getDb } from "@/core/lib/db/client";
import {
  connectorAccess,
  connectors,
  credentials,
  tenantMembers,
  toolConfigs,
} from "@/core/lib/db/tables";
import { decryptSecret, encryptSecret } from "@/core/lib/security/crypto";
import { GMAIL_PROVIDER_ID } from "@/shared/connectors/providers/gmail/provider";
import { GOOGLE_CALENDAR_PROVIDER_ID } from "@/shared/connectors/providers/google-calendar/provider";
import { GOOGLE_DRIVE_PROVIDER_ID } from "@/shared/connectors/providers/google-drive/provider";
import { ChatbotError } from "@/shared/errors";

const db = getDb();

export type CredentialSelect = typeof credentials.$inferSelect;
export type ConnectorSelect = typeof connectors.$inferSelect;
export type ToolConfigSelect = typeof toolConfigs.$inferSelect;
export type ConnectorVisibility = "private" | "organization";

const EMPTY_CONFIG_ENCRYPTED = () => encryptSecret("{}");

function visibilityWhere(
  table: {
    tenantId:
      | typeof credentials.tenantId
      | typeof toolConfigs.tenantId
      | typeof connectors.tenantId;
    ownedByUserId:
      | typeof credentials.ownedByUserId
      | typeof toolConfigs.ownedByUserId
      | typeof connectors.ownedByUserId;
  },
  tenantId: string,
  userId: string
) {
  return and(
    eq(table.tenantId, tenantId),
    or(isNull(table.ownedByUserId), eq(table.ownedByUserId, userId))
  );
}

function ownerFromVisibility(args: {
  visibility: ConnectorVisibility;
  userId: string;
}): string | null {
  return args.visibility === "private" ? args.userId : null;
}

async function userIsConnectorOwner(args: {
  connectorId: string;
  userId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ userId: connectorAccess.userId })
    .from(connectorAccess)
    .where(
      and(
        eq(connectorAccess.connectorId, args.connectorId),
        eq(connectorAccess.userId, args.userId),
        eq(connectorAccess.role, "owner")
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function getCredentialRowByIdForTenant(args: {
  id: string;
  tenantId: string;
  userId: string;
  /**
   * When true, only return credentials owned by this user (no shared /
   * org-null owner path). Required for personal mailbox/chat providers.
   */
  requireOwned?: boolean;
}): Promise<CredentialSelect | null> {
  if (args.requireOwned) {
    const [ownedRow] = await db
      .select()
      .from(credentials)
      .where(
        and(
          eq(credentials.id, args.id),
          eq(credentials.tenantId, args.tenantId),
          eq(credentials.ownedByUserId, args.userId)
        )
      )
      .limit(1);
    return ownedRow ?? null;
  }

  const [directRow] = await db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.id, args.id),
        visibilityWhere(credentials, args.tenantId, args.userId)
      )
    )
    .limit(1);
  if (directRow) {
    return directRow;
  }

  const [sharedRow] = await db
    .select({
      createdAt: credentials.createdAt,
      enabled: credentials.enabled,
      id: credentials.id,
      name: credentials.name,
      oauthScopes: credentials.oauthScopes,
      ownedByUserId: credentials.ownedByUserId,
      provider: credentials.provider,
      secretEncrypted: credentials.secretEncrypted,
      tenantId: credentials.tenantId,
      type: credentials.type,
      updatedAt: credentials.updatedAt,
    })
    .from(credentials)
    .innerJoin(toolConfigs, eq(toolConfigs.credentialId, credentials.id))
    .innerJoin(connectors, eq(toolConfigs.connectorId, connectors.id))
    .innerJoin(
      connectorAccess,
      and(
        eq(connectorAccess.connectorId, connectors.id),
        eq(connectorAccess.userId, args.userId)
      )
    )
    .where(
      and(eq(credentials.id, args.id), eq(credentials.tenantId, args.tenantId))
    )
    .limit(1);
  return sharedRow ?? null;
}

/** Personal mailbox/chat providers must never execute via shared credentials. */
export function isPersonalConnectorProvider(
  providerId: string | null | undefined
) {
  if (!providerId) {
    return false;
  }
  return new Set([
    SLACK_PROVIDER_ID,
    GOOGLE_DRIVE_PROVIDER_ID,
    GMAIL_PROVIDER_ID,
    GOOGLE_CALENDAR_PROVIDER_ID,
  ]).has(providerId);
}

export async function createCredentialRow(args: {
  tenantId: string;
  userId: string;
  name: string;
  type: "api_key" | "oauth2";
  provider: string | null;
  plainSecret: string;
  oauthScopes?: string[] | null;
  visibility: ConnectorVisibility;
}): Promise<CredentialSelect> {
  // Personal mailbox/chat credentials must stay private — org-wide sharing
  // would let others search/act as the credential owner.
  const personalProviders = new Set([
    SLACK_PROVIDER_ID,
    GOOGLE_DRIVE_PROVIDER_ID,
    GMAIL_PROVIDER_ID,
    GOOGLE_CALENDAR_PROVIDER_ID,
  ]);
  if (
    args.visibility === "organization" &&
    args.provider &&
    personalProviders.has(args.provider)
  ) {
    throw new ChatbotError(
      "bad_request:api",
      "This connector credential cannot be shared organization-wide."
    );
  }

  const now = new Date();
  const secretEncrypted = encryptSecret(args.plainSecret);
  const [row] = await db
    .insert(credentials)
    .values({
      createdAt: now,
      enabled: true,
      name: args.name.trim(),
      oauthScopes: args.oauthScopes ?? null,
      ownedByUserId: ownerFromVisibility({
        userId: args.userId,
        visibility: args.visibility,
      }),
      provider: args.provider,
      secretEncrypted,
      tenantId: args.tenantId,
      type: args.type,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create credential"
    );
  }
  return row;
}

export async function updateCredentialSecret(args: {
  id: string;
  tenantId: string;
  userId: string;
  plainSecret: string;
}): Promise<CredentialSelect | null> {
  const existing = await getCredentialRowByIdForTenant({
    id: args.id,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!existing) {
    return null;
  }
  const now = new Date();
  const [row] = await db
    .update(credentials)
    .set({
      secretEncrypted: encryptSecret(args.plainSecret),
      updatedAt: now,
    })
    .where(
      and(
        eq(credentials.id, args.id),
        visibilityWhere(credentials, args.tenantId, args.userId)
      )
    )
    .returning();
  return row ?? null;
}

export async function deleteCredentialRow(args: {
  id: string;
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const res = await db
    .delete(credentials)
    .where(
      and(
        eq(credentials.id, args.id),
        visibilityWhere(credentials, args.tenantId, args.userId)
      )
    )
    .returning({ id: credentials.id });
  return res.length > 0;
}

export async function getConnectorByIdForTenant(args: {
  id: string;
  tenantId: string;
  userId: string;
}): Promise<ConnectorSelect | null> {
  const [row] = await db
    .select({
      createdAt: connectors.createdAt,
      createdBy: connectors.createdBy,
      id: connectors.id,
      name: connectors.name,
      ownedByUserId: connectors.ownedByUserId,
      source: connectors.source,
      status: connectors.status,
      tenantId: connectors.tenantId,
      toolOrder: connectors.toolOrder,
      updatedAt: connectors.updatedAt,
      updatedBy: connectors.updatedBy,
    })
    .from(connectors)
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .where(
      and(
        eq(connectors.id, args.id),
        eq(connectors.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function createConnectorRow(args: {
  tenantId: string;
  userId: string;
  name: string;
  createdBy: string | null;
}): Promise<ConnectorSelect> {
  const now = new Date();
  const trimmed = args.name.trim();
  if (!trimmed) {
    throw new ChatbotError("bad_request:api", "Connection name is required");
  }
  const [row] = await db
    .insert(connectors)
    .values({
      createdAt: now,
      createdBy: args.createdBy,
      name: trimmed,
      ownedByUserId: args.userId,
      source: "connector",
      status: "draft",
      tenantId: args.tenantId,
      toolOrder: null,
      updatedAt: now,
      updatedBy: args.createdBy,
    })
    .returning();
  if (!row) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create connection"
    );
  }
  await db.insert(connectorAccess).values({
    connectorId: row.id,
    createdAt: now,
    grantedBy: args.createdBy ?? args.userId,
    role: "owner",
    updatedAt: now,
    userId: args.userId,
  });
  return row;
}

export async function getToolConfigByIdForTenant(args: {
  id: string;
  tenantId: string;
  userId: string;
}): Promise<ToolConfigSelect | null> {
  const [row] = await db
    .select()
    .from(toolConfigs)
    .where(
      and(eq(toolConfigs.id, args.id), eq(toolConfigs.tenantId, args.tenantId))
    )
    .limit(1);
  if (!row) {
    return null;
  }
  if (!row.connectorId) {
    const [legacyVisible] = await db
      .select({ id: toolConfigs.id })
      .from(toolConfigs)
      .where(
        and(
          eq(toolConfigs.id, args.id),
          visibilityWhere(toolConfigs, args.tenantId, args.userId)
        )
      )
      .limit(1);
    return legacyVisible ? row : null;
  }
  const connectionRow = await getConnectorByIdForTenant({
    id: row.connectorId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  return connectionRow ? row : null;
}

export async function listAccessibleToolConfigsByIdsForTenantUser(args: {
  tenantId: string;
  userId: string;
  ids: string[];
}): Promise<ToolConfigSelect[]> {
  const uniqueIds = [...new Set(args.ids)];
  if (uniqueIds.length === 0) {
    return [];
  }

  const rows = await db
    .select()
    .from(toolConfigs)
    .where(
      and(
        eq(toolConfigs.tenantId, args.tenantId),
        inArray(toolConfigs.id, uniqueIds)
      )
    );
  if (rows.length === 0) {
    return [];
  }

  const connectorIds = [
    ...new Set(
      rows
        .map((row) => row.connectorId)
        .filter((connectorId): connectorId is string => Boolean(connectorId))
    ),
  ];
  const accessibleConnectorIds = new Set<string>();
  if (connectorIds.length > 0) {
    const accessible = await db
      .select({ id: connectors.id })
      .from(connectors)
      .innerJoin(
        connectorAccess,
        eq(connectorAccess.connectorId, connectors.id)
      )
      .where(
        and(
          eq(connectors.tenantId, args.tenantId),
          eq(connectorAccess.userId, args.userId),
          inArray(connectors.id, connectorIds)
        )
      );
    for (const connector of accessible) {
      accessibleConnectorIds.add(connector.id);
    }
  }

  const legacyIds = rows.filter((row) => !row.connectorId).map((row) => row.id);
  const visibleLegacyIds = new Set<string>();
  if (legacyIds.length > 0) {
    const visible = await db
      .select({ id: toolConfigs.id })
      .from(toolConfigs)
      .where(
        and(
          inArray(toolConfigs.id, legacyIds),
          visibilityWhere(toolConfigs, args.tenantId, args.userId)
        )
      );
    for (const row of visible) {
      visibleLegacyIds.add(row.id);
    }
  }

  return rows.filter((row) => {
    if (row.connectorId) {
      return accessibleConnectorIds.has(row.connectorId);
    }
    return visibleLegacyIds.has(row.id);
  });
}

export async function getCredentialRowsByIdsForTenant(args: {
  tenantId: string;
  userId: string;
  credentialIds: string[];
  requireOwnedByCredentialId?: Map<string, boolean>;
}): Promise<Map<string, CredentialSelect | null>> {
  const uniqueIds = [...new Set(args.credentialIds)];
  const result = new Map<string, CredentialSelect | null>();
  if (uniqueIds.length === 0) {
    return result;
  }

  const ownedIds = uniqueIds.filter(
    (id) => args.requireOwnedByCredentialId?.get(id) === true
  );
  const sharedIds = uniqueIds.filter((id) => !ownedIds.includes(id));

  if (ownedIds.length > 0) {
    const ownedRows = await db
      .select()
      .from(credentials)
      .where(
        and(
          inArray(credentials.id, ownedIds),
          eq(credentials.tenantId, args.tenantId),
          eq(credentials.ownedByUserId, args.userId)
        )
      );
    for (const row of ownedRows) {
      result.set(row.id, row);
    }
    for (const id of ownedIds) {
      if (!result.has(id)) {
        result.set(id, null);
      }
    }
  }

  if (sharedIds.length > 0) {
    const directRows = await db
      .select()
      .from(credentials)
      .where(
        and(
          inArray(credentials.id, sharedIds),
          visibilityWhere(credentials, args.tenantId, args.userId)
        )
      );
    for (const row of directRows) {
      result.set(row.id, row);
    }

    const unresolvedIds = sharedIds.filter((id) => !result.has(id));
    if (unresolvedIds.length > 0) {
      const sharedRows = await db
        .select({
          createdAt: credentials.createdAt,
          enabled: credentials.enabled,
          id: credentials.id,
          name: credentials.name,
          oauthScopes: credentials.oauthScopes,
          ownedByUserId: credentials.ownedByUserId,
          provider: credentials.provider,
          secretEncrypted: credentials.secretEncrypted,
          tenantId: credentials.tenantId,
          type: credentials.type,
          updatedAt: credentials.updatedAt,
        })
        .from(credentials)
        .innerJoin(toolConfigs, eq(toolConfigs.credentialId, credentials.id))
        .innerJoin(connectors, eq(toolConfigs.connectorId, connectors.id))
        .innerJoin(
          connectorAccess,
          and(
            eq(connectorAccess.connectorId, connectors.id),
            eq(connectorAccess.userId, args.userId)
          )
        )
        .where(
          and(
            inArray(credentials.id, unresolvedIds),
            eq(credentials.tenantId, args.tenantId)
          )
        );
      for (const row of sharedRows) {
        result.set(row.id, row);
      }
    }

    for (const id of sharedIds) {
      if (!result.has(id)) {
        result.set(id, null);
      }
    }
  }

  return result;
}

export async function getConnectorsByIdsForTenantUser(args: {
  tenantId: string;
  userId: string;
  connectorIds: string[];
}): Promise<Map<string, ConnectorSelect>> {
  const uniqueIds = [...new Set(args.connectorIds)];
  const result = new Map<string, ConnectorSelect>();
  if (uniqueIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      createdAt: connectors.createdAt,
      createdBy: connectors.createdBy,
      id: connectors.id,
      name: connectors.name,
      ownedByUserId: connectors.ownedByUserId,
      source: connectors.source,
      status: connectors.status,
      tenantId: connectors.tenantId,
      toolOrder: connectors.toolOrder,
      updatedAt: connectors.updatedAt,
      updatedBy: connectors.updatedBy,
    })
    .from(connectors)
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .where(
      and(
        eq(connectors.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        inArray(connectors.id, uniqueIds)
      )
    );
  for (const row of rows) {
    result.set(row.id, row);
  }
  return result;
}

export async function replaceToolConfigsForConnector(args: {
  tenantId: string;
  userId: string;
  connectorId: string;
  credentialId: string;
  tools: Array<{ providerId: string; toolIds: string[] }>;
  configEncrypted?: string;
}): Promise<ToolConfigSelect[]> {
  const cred = await getCredentialRowByIdForTenant({
    id: args.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!cred) {
    throw new ChatbotError("bad_request:api", "Credential not found");
  }

  const connectionRow = await getConnectorByIdForTenant({
    id: args.connectorId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connectionRow) {
    throw new ChatbotError("not_found:api", "Connection not found");
  }
  if (
    !(await userIsConnectorOwner({
      connectorId: args.connectorId,
      userId: args.userId,
    }))
  ) {
    throw new ChatbotError(
      "forbidden:api",
      "Only the owner can update tool configuration."
    );
  }

  await db
    .delete(toolConfigs)
    .where(
      and(
        eq(toolConfigs.connectorId, args.connectorId),
        eq(toolConfigs.tenantId, args.tenantId)
      )
    );

  const now = new Date();
  const enc = args.configEncrypted ?? EMPTY_CONFIG_ENCRYPTED();
  const inserted: ToolConfigSelect[] = [];
  for (const group of args.tools) {
    for (const toolId of group.toolIds) {
      const [row] = await db
        .insert(toolConfigs)
        .values({
          configEncrypted: enc,
          connectorId: args.connectorId,
          createdAt: now,
          credentialId: args.credentialId,
          name: null,
          ownedByUserId: connectionRow.ownedByUserId,
          providerId: group.providerId,
          tenantId: args.tenantId,
          toolId,
          updatedAt: now,
        })
        .returning();
      if (row) {
        inserted.push(row);
      }
    }
  }

  const orderIds = inserted.map((r) => r.id);
  await db
    .update(connectors)
    .set({ status: "active", toolOrder: orderIds, updatedAt: now })
    .where(
      and(
        eq(connectors.id, args.connectorId),
        visibilityWhere(connectors, args.tenantId, args.userId)
      )
    );

  return inserted;
}

export async function syncMissingToolConfigsForConnector(args: {
  tenantId: string;
  userId: string;
  connectorId: string;
  credentialId: string;
  tools: Array<{ providerId: string; toolIds: string[] }>;
  configEncrypted?: string;
}): Promise<string[]> {
  const connectionRow = await getConnectorByIdForTenant({
    id: args.connectorId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connectionRow) {
    return [];
  }

  const existingRows = await db
    .select({
      configEncrypted: toolConfigs.configEncrypted,
      providerId: toolConfigs.providerId,
      toolId: toolConfigs.toolId,
    })
    .from(toolConfigs)
    .where(
      and(
        eq(toolConfigs.connectorId, args.connectorId),
        eq(toolConfigs.tenantId, args.tenantId)
      )
    );

  const existingKeys = new Set(
    existingRows.map((row) => `${row.providerId}:${row.toolId}`)
  );
  const configEncrypted =
    args.configEncrypted ??
    existingRows.at(0)?.configEncrypted ??
    EMPTY_CONFIG_ENCRYPTED();

  const now = new Date();
  const insertedIds: string[] = [];
  for (const group of args.tools) {
    for (const toolId of group.toolIds) {
      const key = `${group.providerId}:${toolId}`;
      if (existingKeys.has(key)) {
        continue;
      }
      const [row] = await db
        .insert(toolConfigs)
        .values({
          configEncrypted,
          connectorId: args.connectorId,
          createdAt: now,
          credentialId: args.credentialId,
          name: null,
          ownedByUserId: connectionRow.ownedByUserId,
          providerId: group.providerId,
          tenantId: args.tenantId,
          toolId,
          updatedAt: now,
        })
        .returning({ id: toolConfigs.id });
      if (row) {
        insertedIds.push(row.id);
        existingKeys.add(key);
      }
    }
  }

  if (insertedIds.length === 0) {
    return [];
  }

  const nextToolOrder = [...(connectionRow.toolOrder ?? []), ...insertedIds];
  await db
    .update(connectors)
    .set({ status: "active", toolOrder: nextToolOrder, updatedAt: now })
    .where(
      and(
        eq(connectors.id, args.connectorId),
        visibilityWhere(connectors, args.tenantId, args.userId)
      )
    );

  return insertedIds;
}

export async function listActiveToolConfigIdsForTenantUser(args: {
  tenantId: string;
  userId: string;
  providerId?: string;
}): Promise<string[]> {
  const rows = await db
    .select({ id: toolConfigs.id })
    .from(toolConfigs)
    .innerJoin(connectors, eq(toolConfigs.connectorId, connectors.id))
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .innerJoin(credentials, eq(toolConfigs.credentialId, credentials.id))
    .where(
      and(
        eq(toolConfigs.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        eq(connectors.status, "active"),
        eq(credentials.enabled, true),
        args.providerId
          ? eq(toolConfigs.providerId, args.providerId)
          : undefined
      )
    )
    .orderBy(desc(toolConfigs.updatedAt));

  return rows.map((row) => row.id);
}

export type GoogleDriveConnectorSummary = {
  connectorId: string;
  credentialId: string;
  googleAccountEmail: string | null;
};

export type GoogleDriveTenantConnector = {
  userId: string;
  credentialId: string;
};

export type ConfluenceConnectorSummary = {
  connectorId: string;
  credentialId: string;
  siteUrl: string | null;
  confluenceUserEmail: string | null;
};

export type NotionConnectorSummary = {
  connectorId: string;
  credentialId: string;
  workspaceName: string | null;
  notionUserEmail: string | null;
};

export type SharePointConnectorSummary = {
  connectorId: string;
  credentialId: string;
  tenantId: string | null;
  sharePointUserEmail: string | null;
};

export type SlackConnectorSummary = {
  connectorId: string;
  credentialId: string;
  teamName: string | null;
  slackUserEmail: string | null;
};

export type JiraConnectorSummary = {
  connectorId: string;
  credentialId: string;
  siteName: string | null;
  jiraUserEmail: string | null;
};

export async function getGoogleDriveConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<GoogleDriveConnectorSummary | null> {
  const googleQueries = await import(
    "@/core/lib/connectors/providers/google-shared/queries"
  );
  await googleQueries.migrateLegacyUnifiedGoogleConnectorIfNeeded(args);
  return await googleQueries.getGoogleAppConnectorForTenantUser({
    ...args,
    appId: "google-drive",
  });
}

export async function listGoogleDriveConnectorsForTenant(args: {
  tenantId: string;
}): Promise<GoogleDriveTenantConnector[]> {
  const [activeConnections, activeCredentials] = await Promise.all([
    db
      .select({ userId: connectorAccess.userId })
      .from(connectors)
      .innerJoin(
        connectorAccess,
        eq(connectorAccess.connectorId, connectors.id)
      )
      .where(
        and(
          eq(connectors.tenantId, args.tenantId),
          eq(connectors.status, "active"),
          eq(connectors.name, "Google Drive")
        )
      ),
    db
      .select({
        credentialId: credentials.id,
        userId: credentials.ownedByUserId,
      })
      .from(credentials)
      .where(
        and(
          eq(credentials.tenantId, args.tenantId),
          eq(credentials.provider, GOOGLE_DRIVE_PROVIDER_ID),
          eq(credentials.enabled, true)
        )
      )
      .orderBy(desc(credentials.updatedAt)),
  ]);

  const credentialByUser = new Map<string, string>();
  for (const row of activeCredentials) {
    if (!row.userId || credentialByUser.has(row.userId)) {
      continue;
    }
    credentialByUser.set(row.userId, row.credentialId);
  }

  const dedup = new Map<string, GoogleDriveTenantConnector>();
  for (const row of activeConnections) {
    const credentialId = credentialByUser.get(row.userId);
    if (!credentialId || dedup.has(row.userId)) {
      continue;
    }
    dedup.set(row.userId, {
      credentialId,
      userId: row.userId,
    });
  }
  return [...dedup.values()];
}

export async function deleteGoogleDriveConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const googleQueries = await import(
    "@/core/lib/connectors/providers/google-shared/queries"
  );
  return await googleQueries.deleteGoogleAppConnectorForTenantUser({
    ...args,
    appId: "google-drive",
  });
}

export async function getConfluenceConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<ConfluenceConnectorSummary | null> {
  const [connectionRow, credentialRow] = await Promise.all([
    db
      .select({ connectorId: connectors.id })
      .from(connectors)
      .innerJoin(
        connectorAccess,
        eq(connectorAccess.connectorId, connectors.id)
      )
      .where(
        and(
          eq(connectors.tenantId, args.tenantId),
          eq(connectorAccess.userId, args.userId),
          eq(connectors.status, "active"),
          eq(connectors.name, "Confluence")
        )
      )
      .orderBy(desc(connectors.updatedAt))
      .limit(1),
    db
      .select({
        credentialId: credentials.id,
        secretEncrypted: credentials.secretEncrypted,
      })
      .from(credentials)
      .where(
        and(
          eq(credentials.tenantId, args.tenantId),
          eq(credentials.ownedByUserId, args.userId),
          eq(credentials.provider, CONFLUENCE_PROVIDER_ID),
          eq(credentials.enabled, true)
        )
      )
      .orderBy(desc(credentials.updatedAt))
      .limit(1),
  ]);

  const connection = connectionRow.at(0);
  const credential = credentialRow.at(0);
  if (!connection || !credential) {
    return null;
  }

  let siteUrl: string | null = null;
  let confluenceUserEmail: string | null = null;
  try {
    const secret = JSON.parse(decryptSecret(credential.secretEncrypted)) as {
      site_url?: string;
      user_email?: string;
    };
    siteUrl = secret.site_url ?? null;
    confluenceUserEmail = secret.user_email ?? null;
  } catch {
    siteUrl = null;
    confluenceUserEmail = null;
  }

  return {
    confluenceUserEmail,
    connectorId: connection.connectorId,
    credentialId: credential.credentialId,
    siteUrl,
  };
}

export async function deleteConfluenceConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const summary = await getConfluenceConnectorForTenantUser(args);
  if (!summary) {
    return false;
  }

  await db
    .delete(connectors)
    .where(
      and(
        eq(connectors.id, summary.connectorId),
        eq(connectors.tenantId, args.tenantId),
        eq(connectors.ownedByUserId, args.userId)
      )
    );

  await deleteCredentialRow({
    id: summary.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return true;
}

export async function getNotionConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<NotionConnectorSummary | null> {
  const [connectionRow, credentialRow] = await Promise.all([
    db
      .select({ connectorId: connectors.id })
      .from(connectors)
      .innerJoin(
        connectorAccess,
        eq(connectorAccess.connectorId, connectors.id)
      )
      .where(
        and(
          eq(connectors.tenantId, args.tenantId),
          eq(connectorAccess.userId, args.userId),
          eq(connectors.status, "active"),
          eq(connectors.name, "Notion")
        )
      )
      .orderBy(desc(connectors.updatedAt))
      .limit(1),
    db
      .select({
        credentialId: credentials.id,
        secretEncrypted: credentials.secretEncrypted,
      })
      .from(credentials)
      .where(
        and(
          eq(credentials.tenantId, args.tenantId),
          eq(credentials.ownedByUserId, args.userId),
          eq(credentials.provider, NOTION_PROVIDER_ID),
          eq(credentials.enabled, true)
        )
      )
      .orderBy(desc(credentials.updatedAt))
      .limit(1),
  ]);

  const connection = connectionRow.at(0);
  const credential = credentialRow.at(0);
  if (!connection || !credential) {
    return null;
  }

  let workspaceName: string | null = null;
  let notionUserEmail: string | null = null;
  try {
    const secret = JSON.parse(decryptSecret(credential.secretEncrypted)) as {
      workspace_name?: string | null;
      user_email?: string | null;
    };
    workspaceName = secret.workspace_name ?? null;
    notionUserEmail = secret.user_email ?? null;
  } catch {
    workspaceName = null;
    notionUserEmail = null;
  }

  return {
    connectorId: connection.connectorId,
    credentialId: credential.credentialId,
    notionUserEmail,
    workspaceName,
  };
}

export async function deleteNotionConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const summary = await getNotionConnectorForTenantUser(args);
  if (!summary) {
    return false;
  }

  await db
    .delete(connectors)
    .where(
      and(
        eq(connectors.id, summary.connectorId),
        eq(connectors.tenantId, args.tenantId),
        eq(connectors.ownedByUserId, args.userId)
      )
    );

  await deleteCredentialRow({
    id: summary.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return true;
}

export async function getSharePointConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<SharePointConnectorSummary | null> {
  const [connectionRow, credentialRow] = await Promise.all([
    db
      .select({ connectorId: connectors.id })
      .from(connectors)
      .innerJoin(
        connectorAccess,
        eq(connectorAccess.connectorId, connectors.id)
      )
      .where(
        and(
          eq(connectors.tenantId, args.tenantId),
          eq(connectorAccess.userId, args.userId),
          eq(connectors.status, "active"),
          eq(connectors.name, "SharePoint")
        )
      )
      .orderBy(desc(connectors.updatedAt))
      .limit(1),
    db
      .select({
        credentialId: credentials.id,
        secretEncrypted: credentials.secretEncrypted,
      })
      .from(credentials)
      .where(
        and(
          eq(credentials.tenantId, args.tenantId),
          eq(credentials.ownedByUserId, args.userId),
          eq(credentials.provider, SHAREPOINT_PROVIDER_ID),
          eq(credentials.enabled, true)
        )
      )
      .orderBy(desc(credentials.updatedAt))
      .limit(1),
  ]);

  const connection = connectionRow.at(0);
  const credential = credentialRow.at(0);
  if (!connection || !credential) {
    return null;
  }

  let providerTenantId: string | null = null;
  let sharePointUserEmail: string | null = null;
  try {
    const secret = JSON.parse(decryptSecret(credential.secretEncrypted)) as {
      tenant_id?: string | null;
      user_email?: string | null;
    };
    providerTenantId = secret.tenant_id ?? null;
    sharePointUserEmail = secret.user_email ?? null;
  } catch {
    providerTenantId = null;
    sharePointUserEmail = null;
  }

  return {
    connectorId: connection.connectorId,
    credentialId: credential.credentialId,
    sharePointUserEmail,
    tenantId: providerTenantId,
  };
}

export async function deleteSharePointConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const summary = await getSharePointConnectorForTenantUser(args);
  if (!summary) {
    return false;
  }

  await db
    .delete(connectors)
    .where(
      and(
        eq(connectors.id, summary.connectorId),
        eq(connectors.tenantId, args.tenantId),
        eq(connectors.ownedByUserId, args.userId)
      )
    );

  await deleteCredentialRow({
    id: summary.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return true;
}

export async function getSlackConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
  /** When true, only the caller's own OAuth credential (live search). */
  requireOwned?: boolean;
}): Promise<SlackConnectorSummary | null> {
  // Resolve via connectorAccess + toolConfigs so shared connectors work the
  // same way dedicated chat tools do (not only ownedByUserId credentials).
  const [row] = await db
    .select({
      connectorId: connectors.id,
      credentialId: credentials.id,
      secretEncrypted: credentials.secretEncrypted,
    })
    .from(connectors)
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .innerJoin(toolConfigs, eq(toolConfigs.connectorId, connectors.id))
    .innerJoin(credentials, eq(credentials.id, toolConfigs.credentialId))
    .where(
      and(
        eq(connectors.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        eq(connectors.status, "active"),
        eq(connectors.name, "Slack"),
        eq(credentials.provider, SLACK_PROVIDER_ID),
        eq(credentials.enabled, true),
        args.requireOwned
          ? eq(credentials.ownedByUserId, args.userId)
          : undefined
      )
    )
    .orderBy(desc(connectors.updatedAt))
    .limit(1);

  if (!row) {
    return null;
  }

  let teamName: string | null = null;
  let slackUserEmail: string | null = null;
  try {
    const secret = JSON.parse(decryptSecret(row.secretEncrypted)) as {
      team_name?: string | null;
      user_email?: string | null;
    };
    teamName = secret.team_name ?? null;
    slackUserEmail = secret.user_email ?? null;
  } catch {
    teamName = null;
    slackUserEmail = null;
  }

  return {
    connectorId: row.connectorId,
    credentialId: row.credentialId,
    slackUserEmail,
    teamName,
  };
}

/**
 * Pick a Slack OAuth credential for workspace indexing.
 * Prefers an admin owner's connection; falls back to any active Slack credential.
 */
export async function findSlackIndexingCredentialForTenant(args: {
  tenantId: string;
  preferredUserId?: string;
}): Promise<{
  credentialId: string;
  userId: string;
  teamName: string | null;
} | null> {
  if (args.preferredUserId) {
    const owned = await getSlackConnectorForTenantUser({
      requireOwned: true,
      tenantId: args.tenantId,
      userId: args.preferredUserId,
    });
    if (owned) {
      return {
        credentialId: owned.credentialId,
        teamName: owned.teamName,
        userId: args.preferredUserId,
      };
    }
  }

  const rows = await db
    .select({
      credentialId: credentials.id,
      memberRole: tenantMembers.role,
      secretEncrypted: credentials.secretEncrypted,
      userId: credentials.ownedByUserId,
    })
    .from(credentials)
    .innerJoin(toolConfigs, eq(toolConfigs.credentialId, credentials.id))
    .innerJoin(connectors, eq(connectors.id, toolConfigs.connectorId))
    .leftJoin(
      tenantMembers,
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, credentials.ownedByUserId)
      )
    )
    .where(
      and(
        eq(credentials.tenantId, args.tenantId),
        eq(credentials.provider, SLACK_PROVIDER_ID),
        eq(credentials.enabled, true),
        eq(connectors.status, "active"),
        eq(connectors.name, "Slack")
      )
    )
    .orderBy(desc(credentials.updatedAt));

  const withOwner = rows.filter((row): row is typeof row & { userId: string } =>
    Boolean(row.userId)
  );
  if (withOwner.length === 0) {
    return null;
  }

  const adminOwned = withOwner.find((row) => row.memberRole === "admin");
  const chosen = adminOwned ?? withOwner.at(0);
  if (!chosen) {
    return null;
  }

  let teamName: string | null = null;
  try {
    const secret = JSON.parse(decryptSecret(chosen.secretEncrypted)) as {
      team_name?: string | null;
    };
    teamName = secret.team_name ?? null;
  } catch {
    teamName = null;
  }

  return {
    credentialId: chosen.credentialId,
    teamName,
    userId: chosen.userId,
  };
}

export async function deleteSlackConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const summary = await getSlackConnectorForTenantUser(args);
  if (!summary) {
    return false;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(connectors)
      .where(
        and(
          eq(connectors.id, summary.connectorId),
          eq(connectors.tenantId, args.tenantId),
          eq(connectors.ownedByUserId, args.userId)
        )
      );

    await tx
      .delete(credentials)
      .where(
        and(
          eq(credentials.id, summary.credentialId),
          visibilityWhere(credentials, args.tenantId, args.userId)
        )
      );
  });

  return true;
}

export async function getJiraConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
  /** When true, only the caller's own OAuth credential (live search). */
  requireOwned?: boolean;
}): Promise<JiraConnectorSummary | null> {
  const [row] = await db
    .select({
      connectorId: connectors.id,
      credentialId: credentials.id,
      secretEncrypted: credentials.secretEncrypted,
    })
    .from(connectors)
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .innerJoin(toolConfigs, eq(toolConfigs.connectorId, connectors.id))
    .innerJoin(credentials, eq(credentials.id, toolConfigs.credentialId))
    .where(
      and(
        eq(connectors.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        eq(connectors.status, "active"),
        eq(connectors.name, "Jira"),
        eq(credentials.provider, JIRA_PROVIDER_ID),
        eq(credentials.enabled, true),
        args.requireOwned
          ? eq(credentials.ownedByUserId, args.userId)
          : undefined
      )
    )
    .orderBy(desc(connectors.updatedAt))
    .limit(1);

  if (!row) {
    return null;
  }

  let siteName: string | null = null;
  let jiraUserEmail: string | null = null;
  try {
    const secret = JSON.parse(decryptSecret(row.secretEncrypted)) as {
      site_url?: string | null;
      user_email?: string | null;
    };
    siteName = secret.site_url ?? null;
    jiraUserEmail = secret.user_email ?? null;
  } catch {
    siteName = null;
    jiraUserEmail = null;
  }

  return {
    connectorId: row.connectorId,
    credentialId: row.credentialId,
    jiraUserEmail,
    siteName,
  };
}

export async function deleteJiraConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const summary = await getJiraConnectorForTenantUser(args);
  if (!summary) {
    return false;
  }

  await db
    .delete(connectors)
    .where(
      and(
        eq(connectors.id, summary.connectorId),
        eq(connectors.tenantId, args.tenantId),
        eq(connectors.ownedByUserId, args.userId)
      )
    );

  await deleteCredentialRow({
    id: summary.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return true;
}

export async function deleteConnectionsByIds(args: {
  tenantId: string;
  userId: string;
  connectorIds: string[];
}): Promise<void> {
  if (args.connectorIds.length === 0) {
    return;
  }
  await db
    .delete(connectors)
    .where(
      and(
        eq(connectors.tenantId, args.tenantId),
        eq(connectors.ownedByUserId, args.userId),
        inArray(connectors.id, args.connectorIds)
      )
    );
}
