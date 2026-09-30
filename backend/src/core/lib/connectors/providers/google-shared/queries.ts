import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  createConnectorRow,
  createCredentialRow,
  deleteCredentialRow,
  updateCredentialSecret,
} from "@/core/lib/db/connector-queries";
import {
  connectorAccess,
  connectors,
  credentials,
  toolConfigs,
} from "@/core/lib/db/tables";
import { decryptSecret } from "@/core/lib/security/crypto";
import { GOOGLE_DRIVE_PROVIDER_ID } from "@/shared/connectors/providers/google-drive/provider";
import {
  GOOGLE_PROVIDER_IDS,
  GOOGLE_WORKSPACE_APPS,
  type GoogleAppId,
  getGoogleWorkspaceApp,
  getGoogleWorkspaceAppByProviderId,
  mergeGoogleOAuthScopeStrings,
} from "@/shared/connectors/providers/google-shared/apps";

const db = getDb();

const LEGACY_UNIFIED_CONNECTION_NAME = "Google Drive";

export type GoogleAppConnectorSummary = {
  connectorId: string;
  credentialId: string;
  googleAccountEmail: string | null;
};

export type GoogleSharedCredentialSummary = {
  credentialId: string;
  googleAccountEmail: string | null;
  hasRefreshToken: boolean;
  scope: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

function parseGoogleAccountEmail(secretEncrypted: string): string | null {
  try {
    const secret = JSON.parse(decryptSecret(secretEncrypted)) as {
      google_account_email?: string;
      refresh_token?: string | null;
    };
    return secret.google_account_email ?? null;
  } catch {
    return null;
  }
}

function parseGoogleCredentialSecret(secretEncrypted: string): {
  googleAccountEmail: string | null;
  hasRefreshToken: boolean;
  scope: string | null;
  accessToken: string | null;
  refreshToken: string | null;
} {
  try {
    const secret = JSON.parse(decryptSecret(secretEncrypted)) as {
      google_account_email?: string;
      refresh_token?: string | null;
      access_token?: string;
      scope?: string;
    };
    return {
      accessToken: secret.access_token ?? null,
      googleAccountEmail: secret.google_account_email ?? null,
      hasRefreshToken: Boolean(secret.refresh_token),
      refreshToken: secret.refresh_token ?? null,
      scope: secret.scope ?? null,
    };
  } catch {
    return {
      accessToken: null,
      googleAccountEmail: null,
      hasRefreshToken: false,
      refreshToken: null,
      scope: null,
    };
  }
}

export async function getGoogleSharedCredentialForTenantUser(args: {
  tenantId: string;
  userId: string;
  /** When true, skip shared credentials (live Gmail/Calendar search). */
  requireOwned?: boolean;
}): Promise<GoogleSharedCredentialSummary | null> {
  const [ownedRow] = await db
    .select({
      credentialId: credentials.id,
      secretEncrypted: credentials.secretEncrypted,
    })
    .from(credentials)
    .where(
      and(
        eq(credentials.tenantId, args.tenantId),
        eq(credentials.ownedByUserId, args.userId),
        eq(credentials.provider, GOOGLE_DRIVE_PROVIDER_ID),
        eq(credentials.enabled, true)
      )
    )
    .orderBy(desc(credentials.updatedAt))
    .limit(1);

  if (ownedRow) {
    const parsed = parseGoogleCredentialSecret(ownedRow.secretEncrypted);
    return {
      accessToken: parsed.accessToken,
      credentialId: ownedRow.credentialId,
      googleAccountEmail: parsed.googleAccountEmail,
      hasRefreshToken: parsed.hasRefreshToken,
      refreshToken: parsed.refreshToken,
      scope: parsed.scope,
    };
  }

  if (args.requireOwned) {
    return null;
  }

  // Shared connector path: credential owned by another user, access via connectorAccess.
  const [sharedRow] = await db
    .select({
      credentialId: credentials.id,
      secretEncrypted: credentials.secretEncrypted,
    })
    .from(credentials)
    .innerJoin(toolConfigs, eq(toolConfigs.credentialId, credentials.id))
    .innerJoin(connectors, eq(connectors.id, toolConfigs.connectorId))
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .where(
      and(
        eq(credentials.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        eq(connectors.status, "active"),
        eq(credentials.provider, GOOGLE_DRIVE_PROVIDER_ID),
        eq(credentials.enabled, true)
      )
    )
    .orderBy(desc(credentials.updatedAt))
    .limit(1);

  if (!sharedRow) {
    return null;
  }

  const parsed = parseGoogleCredentialSecret(sharedRow.secretEncrypted);
  return {
    accessToken: parsed.accessToken,
    credentialId: sharedRow.credentialId,
    googleAccountEmail: parsed.googleAccountEmail,
    hasRefreshToken: parsed.hasRefreshToken,
    refreshToken: parsed.refreshToken,
    scope: parsed.scope,
  };
}

async function getConnectionByNameForTenantUser(args: {
  tenantId: string;
  userId: string;
  connectionName: string;
}): Promise<{ connectorId: string } | null> {
  const [row] = await db
    .select({ connectorId: connectors.id })
    .from(connectors)
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .where(
      and(
        eq(connectors.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        eq(connectors.status, "active"),
        eq(connectors.name, args.connectionName)
      )
    )
    .orderBy(desc(connectors.updatedAt))
    .limit(1);

  return row ?? null;
}

export async function getGoogleAppConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
  appId: GoogleAppId;
  requireOwned?: boolean;
}): Promise<GoogleAppConnectorSummary | null> {
  const app = getGoogleWorkspaceApp(args.appId);
  if (!app) {
    return null;
  }

  // Resolve via toolConfigs + connectorAccess so live search uses the same
  // credentialId as dedicated chat tools. Looking up "latest owned Google
  // Workspace credential" separately can pick a newer Drive-only OAuth row
  // that lacks Gmail/Calendar scopes while tools still work.
  const ownedFilter = args.requireOwned
    ? eq(credentials.ownedByUserId, args.userId)
    : undefined;

  const connectionNameCandidates = [
    app.connectionName,
    ...(app.connectionName === LEGACY_UNIFIED_CONNECTION_NAME
      ? []
      : [LEGACY_UNIFIED_CONNECTION_NAME]),
  ];

  for (const connectionName of connectionNameCandidates) {
    const [row] = await db
      .select({
        connectorId: connectors.id,
        credentialId: credentials.id,
        secretEncrypted: credentials.secretEncrypted,
      })
      .from(connectors)
      .innerJoin(
        connectorAccess,
        eq(connectorAccess.connectorId, connectors.id)
      )
      .innerJoin(toolConfigs, eq(toolConfigs.connectorId, connectors.id))
      .innerJoin(credentials, eq(credentials.id, toolConfigs.credentialId))
      .where(
        and(
          eq(connectors.tenantId, args.tenantId),
          eq(connectorAccess.userId, args.userId),
          eq(connectors.status, "active"),
          eq(connectors.name, connectionName),
          eq(toolConfigs.providerId, app.providerId),
          eq(credentials.enabled, true),
          ownedFilter
        )
      )
      .orderBy(desc(toolConfigs.updatedAt))
      .limit(1);

    if (row) {
      return {
        connectorId: row.connectorId,
        credentialId: row.credentialId,
        googleAccountEmail: parseGoogleAccountEmail(row.secretEncrypted),
      };
    }
  }

  // Renamed / non-standard connection names: any connector with this app's tools.
  const [anyRow] = await db
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
        eq(toolConfigs.providerId, app.providerId),
        eq(credentials.enabled, true),
        ownedFilter
      )
    )
    .orderBy(desc(toolConfigs.updatedAt))
    .limit(1);

  if (!anyRow) {
    return null;
  }

  return {
    connectorId: anyRow.connectorId,
    credentialId: anyRow.credentialId,
    googleAccountEmail: parseGoogleAccountEmail(anyRow.secretEncrypted),
  };
}

export async function userHasAnyGoogleToolConfigs(args: {
  tenantId: string;
  userId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ id: toolConfigs.id })
    .from(toolConfigs)
    .innerJoin(
      connectorAccess,
      eq(connectorAccess.connectorId, toolConfigs.connectorId)
    )
    .where(
      and(
        eq(toolConfigs.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        inArray(toolConfigs.providerId, GOOGLE_PROVIDER_IDS)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function deleteGoogleAppConnectorForTenantUser(args: {
  tenantId: string;
  userId: string;
  appId: GoogleAppId;
}): Promise<boolean> {
  const app = getGoogleWorkspaceApp(args.appId);
  if (!app) {
    return false;
  }

  const connection = await getGoogleAppConnectorForTenantUser(args);
  if (!connection) {
    return false;
  }

  await db
    .delete(toolConfigs)
    .where(
      and(
        eq(toolConfigs.tenantId, args.tenantId),
        eq(toolConfigs.connectorId, connection.connectorId),
        eq(toolConfigs.providerId, app.providerId)
      )
    );

  const remainingToolConfigs = await db
    .select({ id: toolConfigs.id })
    .from(toolConfigs)
    .where(
      and(
        eq(toolConfigs.tenantId, args.tenantId),
        eq(toolConfigs.connectorId, connection.connectorId)
      )
    )
    .limit(1);

  if (remainingToolConfigs.length === 0) {
    await db
      .delete(connectors)
      .where(
        and(
          eq(connectors.id, connection.connectorId),
          eq(connectors.tenantId, args.tenantId),
          eq(connectors.ownedByUserId, args.userId)
        )
      );
  }

  const hasGoogleTools = await userHasAnyGoogleToolConfigs(args);
  if (!hasGoogleTools) {
    await deleteCredentialRow({
      id: connection.credentialId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
  }

  return true;
}

export async function deleteAllGoogleAppConnectionsForTenantUser(args: {
  tenantId: string;
  userId: string;
}): Promise<void> {
  const credential = await getGoogleSharedCredentialForTenantUser(args);
  if (!credential) {
    return;
  }

  const connectionNames = GOOGLE_WORKSPACE_APPS.map(
    (app) => app.connectionName
  );
  const userConnections = await db
    .select({ connectorId: connectors.id })
    .from(connectors)
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .where(
      and(
        eq(connectors.tenantId, args.tenantId),
        eq(connectorAccess.userId, args.userId),
        inArray(connectors.name, connectionNames)
      )
    );

  const connectorIds = userConnections.map((row) => row.connectorId);
  if (connectorIds.length > 0) {
    await db
      .delete(toolConfigs)
      .where(
        and(
          eq(toolConfigs.tenantId, args.tenantId),
          inArray(toolConfigs.connectorId, connectorIds),
          inArray(toolConfigs.providerId, GOOGLE_PROVIDER_IDS)
        )
      );

    await db
      .delete(connectors)
      .where(
        and(
          eq(connectors.tenantId, args.tenantId),
          eq(connectors.ownedByUserId, args.userId),
          inArray(connectors.id, connectorIds)
        )
      );
  }

  await deleteCredentialRow({
    id: credential.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
}

export async function migrateLegacyUnifiedGoogleConnectorIfNeeded(args: {
  tenantId: string;
  userId: string;
}): Promise<void> {
  const legacy = await getConnectionByNameForTenantUser({
    connectionName: LEGACY_UNIFIED_CONNECTION_NAME,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!legacy) {
    return;
  }

  const credential = await getGoogleSharedCredentialForTenantUser(args);
  if (!credential) {
    return;
  }

  const toolRows = await db
    .select({
      providerId: toolConfigs.providerId,
    })
    .from(toolConfigs)
    .where(
      and(
        eq(toolConfigs.tenantId, args.tenantId),
        eq(toolConfigs.connectorId, legacy.connectorId),
        inArray(toolConfigs.providerId, GOOGLE_PROVIDER_IDS)
      )
    );

  const providerIds = [...new Set(toolRows.map((row) => row.providerId))];
  if (providerIds.length <= 1) {
    return;
  }

  for (const providerId of providerIds) {
    const app = getGoogleWorkspaceAppByProviderId(providerId);
    if (!app || app.connectionName === LEGACY_UNIFIED_CONNECTION_NAME) {
      continue;
    }

    const dedicated = await getConnectionByNameForTenantUser({
      connectionName: app.connectionName,
      tenantId: args.tenantId,
      userId: args.userId,
    });

    let targetConnectionId = dedicated?.connectorId;
    if (!targetConnectionId) {
      const created = await createConnectorRow({
        createdBy: args.userId,
        name: app.connectionName,
        tenantId: args.tenantId,
        userId: args.userId,
      });
      targetConnectionId = created.id;
      await db
        .update(connectors)
        .set({ status: "active", updatedAt: new Date() })
        .where(eq(connectors.id, created.id));
    }

    await db
      .update(toolConfigs)
      .set({ connectorId: targetConnectionId, updatedAt: new Date() })
      .where(
        and(
          eq(toolConfigs.tenantId, args.tenantId),
          eq(toolConfigs.connectorId, legacy.connectorId),
          eq(toolConfigs.providerId, providerId)
        )
      );
  }

  const remainingOnLegacy = await db
    .select({ id: toolConfigs.id })
    .from(toolConfigs)
    .where(
      and(
        eq(toolConfigs.tenantId, args.tenantId),
        eq(toolConfigs.connectorId, legacy.connectorId)
      )
    )
    .limit(1);

  if (remainingOnLegacy.length === 0) {
    await db
      .delete(connectors)
      .where(
        and(
          eq(connectors.id, legacy.connectorId),
          eq(connectors.tenantId, args.tenantId),
          eq(connectors.ownedByUserId, args.userId)
        )
      );
  }
}

export async function ensureGoogleAppConnectionRow(args: {
  tenantId: string;
  userId: string;
  appId: GoogleAppId;
}): Promise<{ connectorId: string; credentialId: string }> {
  const app = getGoogleWorkspaceApp(args.appId);
  if (!app) {
    throw new Error("Unknown Google app.");
  }

  const credential = await getGoogleSharedCredentialForTenantUser(args);
  if (!credential) {
    throw new Error("Google credential not found.");
  }

  const existing = await getConnectionByNameForTenantUser({
    connectionName: app.connectionName,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  if (existing) {
    return {
      connectorId: existing.connectorId,
      credentialId: credential.credentialId,
    };
  }

  const connRow = await createConnectorRow({
    createdBy: args.userId,
    name: app.connectionName,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  await db
    .update(connectors)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(connectors.id, connRow.id));

  return {
    connectorId: connRow.id,
    credentialId: credential.credentialId,
  };
}

export async function mergeGoogleCredentialSecret(args: {
  tenantId: string;
  userId: string;
  nextTokens: {
    access_token: string;
    refresh_token?: string | null;
    token_type?: string;
    scope?: string;
    expiry_date?: number | null;
    user_email: string;
    google_account_email: string;
  };
}): Promise<{ credentialId: string; mergedScopes: string[] }> {
  const existingCredRow = await db
    .select({
      id: credentials.id,
      oauthScopes: credentials.oauthScopes,
      secretEncrypted: credentials.secretEncrypted,
    })
    .from(credentials)
    .where(
      and(
        eq(credentials.tenantId, args.tenantId),
        eq(credentials.ownedByUserId, args.userId),
        eq(credentials.provider, GOOGLE_DRIVE_PROVIDER_ID),
        eq(credentials.enabled, true)
      )
    )
    .orderBy(desc(credentials.updatedAt))
    .limit(1);

  const existingRow = existingCredRow.at(0);
  let existingSecret: {
    access_token?: string;
    refresh_token?: string | null;
    scope?: string;
  } = {};

  if (existingRow) {
    try {
      existingSecret = JSON.parse(
        decryptSecret(existingRow.secretEncrypted)
      ) as typeof existingSecret;
    } catch {
      existingSecret = {};
    }
  }

  const mergedScopeList = mergeGoogleOAuthScopeStrings(
    // Prefer Google's live grant as source of truth. Still keep prior scopes
    // when include_granted_scopes attached them but the response omitted some.
    args.nextTokens.scope ?? "",
    existingSecret.scope ?? ""
  );
  for (const scope of existingRow?.oauthScopes ?? []) {
    mergedScopeList.push(scope);
  }
  const mergedScopes = [...new Set(mergedScopeList)];

  // If Google returned a new refresh_token, that grant is authoritative — use
  // it. Only keep the prior refresh_token when Google did not issue a new one.
  const secretPayload = JSON.stringify({
    access_token: args.nextTokens.access_token,
    expires_at: args.nextTokens.expiry_date ?? null,
    google_account_email: args.nextTokens.google_account_email,
    refresh_token:
      args.nextTokens.refresh_token ?? existingSecret.refresh_token ?? null,
    scope: mergedScopes.join(" "),
    token_type: args.nextTokens.token_type ?? "Bearer",
    user_email: args.nextTokens.user_email.toLowerCase(),
  });

  if (existingRow) {
    await updateCredentialSecret({
      id: existingRow.id,
      plainSecret: secretPayload,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    await db
      .update(credentials)
      .set({ oauthScopes: mergedScopes, updatedAt: new Date() })
      .where(eq(credentials.id, existingRow.id));
    return { credentialId: existingRow.id, mergedScopes };
  }

  const credRow = await createCredentialRow({
    name: "Google Workspace",
    oauthScopes: mergedScopes,
    plainSecret: secretPayload,
    provider: GOOGLE_DRIVE_PROVIDER_ID,
    tenantId: args.tenantId,
    type: "oauth2",
    userId: args.userId,
    visibility: "private",
  });

  return { credentialId: credRow.id, mergedScopes };
}

export { parseGoogleAccountEmail };
