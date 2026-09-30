import { and, desc, eq } from "drizzle-orm";
import { graphFetch } from "@/core/lib/connectors/providers/sharepoint/api";
import { ensureFreshSharePointAccessToken } from "@/core/lib/connectors/providers/sharepoint/credential-token";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import { getDb } from "@/core/lib/db/client";
import {
  listTenantConnectorExternalGroupMembershipRows,
  markTenantConnectorExternalGroupsStale,
  removeStaleTenantConnectorExternalGroups,
  upsertTenantConnectorUserExternalGroupMemberships,
} from "@/core/lib/db/connector-membership-queries";
import { connectorAccess, connectors, credentials } from "@/core/lib/db/tables";
import { decryptSecret } from "@/core/lib/security/crypto";
import { normalizeSourceEmail } from "@/core/lib/sources/source-external-access";

const db = getDb();

type SharePointCredential = {
  credentialId: string;
  userId: string;
  userEmail: string;
};

function parseSharePointCredential(args: {
  credentialId: string;
  userId: string;
  secretEncrypted: string;
}): Omit<SharePointCredential, "credentialId" | "userId"> | null {
  try {
    const secret = JSON.parse(decryptSecret(args.secretEncrypted)) as {
      user_email?: string | null;
    };
    const userEmail = normalizeSourceEmail(secret.user_email ?? "");
    if (!userEmail) {
      return null;
    }
    return { userEmail };
  } catch {
    return null;
  }
}

async function listActiveSharePointCredentials(
  tenantId: string
): Promise<SharePointCredential[]> {
  const credentialRows = await db
    .select({
      credentialId: credentials.id,
      secretEncrypted: credentials.secretEncrypted,
      userId: credentials.ownedByUserId,
    })
    .from(credentials)
    .where(
      and(
        eq(credentials.tenantId, tenantId),
        eq(credentials.provider, SHAREPOINT_PROVIDER_ID),
        eq(credentials.enabled, true)
      )
    )
    .orderBy(desc(credentials.updatedAt));

  const activeConnectorUsers = await db
    .select({ name: connectors.name, userId: connectorAccess.userId })
    .from(connectors)
    .innerJoin(connectorAccess, eq(connectorAccess.connectorId, connectors.id))
    .where(
      and(eq(connectors.tenantId, tenantId), eq(connectors.status, "active"))
    );
  const activeSharePointUsers = new Set(
    activeConnectorUsers
      .filter((row) => row.name === "SharePoint")
      .map((row) => row.userId)
  );

  const results: SharePointCredential[] = [];
  const seen = new Set<string>();
  for (const row of credentialRows) {
    if (!row.userId || !activeSharePointUsers.has(row.userId)) {
      continue;
    }
    const parsed = parseSharePointCredential({
      credentialId: row.credentialId,
      secretEncrypted: row.secretEncrypted,
      userId: row.userId,
    });
    if (!parsed) {
      continue;
    }
    if (seen.has(parsed.userEmail)) {
      continue;
    }
    seen.add(parsed.userEmail);
    results.push({
      credentialId: row.credentialId,
      userId: row.userId,
      ...parsed,
    });
  }
  return results;
}

type GraphGroup = {
  id?: string;
  displayName?: string;
};

async function fetchSharePointUserGroupIds(accessToken: string) {
  const groupIds = new Set<string>();
  let path: string | null =
    "/me/memberOf/microsoft.graph.group?$select=id,displayName";

  while (path) {
    const response = await graphFetch({
      accessToken,
      path,
    }).catch(() => null);
    if (!response) {
      break;
    }
    const payload = (await response.json()) as {
      value?: GraphGroup[];
      "@odata.nextLink"?: string;
    };
    for (const group of payload.value ?? []) {
      const id = group.id?.trim().toLowerCase();
      if (id) {
        groupIds.add(id);
      }
      const displayName = group.displayName?.trim().toLowerCase();
      if (displayName) {
        groupIds.add(displayName);
      }
    }
    const nextLink = payload["@odata.nextLink"];
    if (!nextLink) {
      path = null;
      continue;
    }
    path = nextLink.replace("https://graph.microsoft.com/v1.0", "");
  }

  return [...groupIds];
}

export async function syncTenantSharePointMemberships(args: {
  tenantId: string;
  userId?: string;
}): Promise<{ membershipRows: number }> {
  const credentialsToSync = await listActiveSharePointCredentials(
    args.tenantId
  );
  const filtered = args.userId
    ? credentialsToSync.filter((row) => row.userId === args.userId)
    : credentialsToSync;

  // Partial (per-user) sync must not stale-delete other users' rows.
  if (args.userId) {
    for (const credential of filtered) {
      await markTenantConnectorExternalGroupsStale({
        sourceType: "sharepoint",
        tenantId: args.tenantId,
        userEmail: credential.userEmail,
      });

      const token = await ensureFreshSharePointAccessToken({
        credentialId: credential.credentialId,
        tenantId: args.tenantId,
        userId: credential.userId,
      }).catch(() => null);
      if (token) {
        const groupIds = await fetchSharePointUserGroupIds(token.accessToken);
        await upsertTenantConnectorUserExternalGroupMemberships({
          externalGroupIds: groupIds,
          sourceType: "sharepoint",
          tenantId: args.tenantId,
          userEmail: credential.userEmail,
        });
      }

      await removeStaleTenantConnectorExternalGroups({
        sourceType: "sharepoint",
        tenantId: args.tenantId,
        userEmail: credential.userEmail,
      });
    }
  } else {
    await markTenantConnectorExternalGroupsStale({
      sourceType: "sharepoint",
      tenantId: args.tenantId,
    });

    for (const credential of filtered) {
      const token = await ensureFreshSharePointAccessToken({
        credentialId: credential.credentialId,
        tenantId: args.tenantId,
        userId: credential.userId,
      }).catch(() => null);
      if (!token) {
        continue;
      }

      const groupIds = await fetchSharePointUserGroupIds(token.accessToken);
      await upsertTenantConnectorUserExternalGroupMemberships({
        externalGroupIds: groupIds,
        sourceType: "sharepoint",
        tenantId: args.tenantId,
        userEmail: credential.userEmail,
      });
    }

    await removeStaleTenantConnectorExternalGroups({
      sourceType: "sharepoint",
      tenantId: args.tenantId,
    });
  }

  const rows = await listTenantConnectorExternalGroupMembershipRows({
    tenantId: args.tenantId,
  });
  return {
    membershipRows: rows.filter((row) => row.sourceType === "sharepoint")
      .length,
  };
}
