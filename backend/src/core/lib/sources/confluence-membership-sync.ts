import { and, desc, eq } from "drizzle-orm";
import { confluenceFetch } from "@/core/lib/connectors/providers/confluence/api";
import { ensureFreshConfluenceAccessToken } from "@/core/lib/connectors/providers/confluence/credential-token";
import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import { getDb } from "@/core/lib/db/client";
import {
  listTenantConnectorExternalGroupMembershipRows,
  markTenantConnectorExternalGroupsStale,
  removeStaleTenantConnectorExternalGroups,
  upsertTenantConnectorUserExternalGroupMemberships,
} from "@/core/lib/db/connector-membership-queries";
import { connectorAccess, connectors, credentials } from "@/core/lib/db/tables";
import { decryptSecret } from "@/core/lib/security/crypto";
import { fetchSpacePermissionAssignments } from "@/core/lib/sources/confluence-source-external-access";
import { normalizeSourceEmail } from "@/core/lib/sources/source-external-access";

const db = getDb();

type ConfluenceCredential = {
  credentialId: string;
  userId: string;
  userEmail: string;
  cloudId: string;
  accountId: string;
};

type ConfluenceMemberGroup = {
  id?: string;
  name?: string;
};

function parseConfluenceCredential(args: {
  credentialId: string;
  userId: string;
  secretEncrypted: string;
}): Omit<ConfluenceCredential, "credentialId" | "userId"> | null {
  try {
    const secret = JSON.parse(decryptSecret(args.secretEncrypted)) as {
      user_email?: string | null;
      cloud_id?: string | null;
      confluence_account_id?: string | null;
    };
    const userEmail = normalizeSourceEmail(secret.user_email ?? "");
    const cloudId = secret.cloud_id?.trim().toLowerCase() ?? "";
    const accountId = secret.confluence_account_id?.trim().toLowerCase() ?? "";
    if (!userEmail || !cloudId || !accountId) {
      return null;
    }
    return { accountId, cloudId, userEmail };
  } catch {
    return null;
  }
}

async function listActiveConfluenceCredentials(
  tenantId: string
): Promise<ConfluenceCredential[]> {
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
        eq(credentials.provider, CONFLUENCE_PROVIDER_ID),
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
  const activeConfluenceUsers = new Set(
    activeConnectorUsers
      .filter((row) => row.name === "Confluence")
      .map((row) => row.userId)
  );

  const results: ConfluenceCredential[] = [];
  const seen = new Set<string>();
  for (const row of credentialRows) {
    if (!row.userId || !activeConfluenceUsers.has(row.userId)) {
      continue;
    }
    const parsed = parseConfluenceCredential({
      credentialId: row.credentialId,
      secretEncrypted: row.secretEncrypted,
      userId: row.userId,
    });
    if (!parsed) {
      continue;
    }
    const key = `${parsed.userEmail}:${parsed.cloudId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push({
      credentialId: row.credentialId,
      userId: row.userId,
      ...parsed,
    });
  }
  return results;
}

function groupIdsFromMemberGroups(groups: ConfluenceMemberGroup[]) {
  const ids = new Set<string>();
  for (const group of groups) {
    const id = group.id?.trim().toLowerCase();
    if (id) {
      ids.add(id);
    }
    const name = group.name?.trim().toLowerCase();
    if (name) {
      ids.add(name);
    }
  }
  return [...ids];
}

async function fetchConfluenceUserGroupIds(args: {
  cloudId: string;
  accessToken: string;
  accountId: string;
}) {
  const groups: ConfluenceMemberGroup[] = [];
  let start = 0;
  const limit = 200;

  while (true) {
    const params = new URLSearchParams({
      accountId: args.accountId,
      limit: String(limit),
      start: String(start),
    });
    const response = await confluenceFetch({
      accessToken: args.accessToken,
      cloudId: args.cloudId,
      path: `/wiki/rest/api/user/memberof?${params.toString()}`,
    }).catch(() => null);
    if (!response) {
      break;
    }
    const payload = (await response.json()) as {
      results?: ConfluenceMemberGroup[];
      size?: number;
    };
    groups.push(...(payload.results ?? []));
    const pageSize = payload.size ?? payload.results?.length ?? 0;
    if (pageSize < limit) {
      break;
    }
    start += limit;
  }

  return groupIdsFromMemberGroups(groups);
}

export async function syncConfluenceSpaceMemberships(args: {
  tenantId: string;
  cloudId: string;
  accessToken: string;
  spaceId: string;
}) {
  const spaceId = args.spaceId.trim().toLowerCase();
  if (!spaceId) {
    return;
  }

  const externalGroupId = `space:${spaceId}`;
  await markTenantConnectorExternalGroupsStale({
    externalGroupId,
    sourceType: "confluence",
    tenantId: args.tenantId,
  });

  const permissions = await fetchSpacePermissionAssignments({
    accessToken: args.accessToken,
    cloudId: args.cloudId,
    spaceId,
  });

  for (const userEmail of permissions.userEmails) {
    await upsertTenantConnectorUserExternalGroupMemberships({
      externalGroupIds: [externalGroupId],
      sourceType: "confluence",
      tenantId: args.tenantId,
      userEmail,
    });
  }

  await removeStaleTenantConnectorExternalGroups({
    externalGroupId,
    sourceType: "confluence",
    tenantId: args.tenantId,
  });
}

export async function syncTenantConfluenceMemberships(args: {
  tenantId: string;
  userId?: string;
}): Promise<{ membershipRows: number }> {
  const credentialsToSync = await listActiveConfluenceCredentials(
    args.tenantId
  );
  const filtered = args.userId
    ? credentialsToSync.filter((row) => row.userId === args.userId)
    : credentialsToSync;

  // Partial (per-user) sync must not stale-delete other users' rows.
  // Space-scoped rows are reconciled only by syncConfluenceSpaceMemberships.
  if (args.userId) {
    for (const credential of filtered) {
      await markTenantConnectorExternalGroupsStale({
        excludeSpaceGroups: true,
        sourceType: "confluence",
        tenantId: args.tenantId,
        userEmail: credential.userEmail,
      });

      const token = await ensureFreshConfluenceAccessToken({
        credentialId: credential.credentialId,
        tenantId: args.tenantId,
        userId: credential.userId,
      }).catch(() => null);
      if (token) {
        const groupIds = await fetchConfluenceUserGroupIds({
          accessToken: token.accessToken,
          accountId: credential.accountId,
          cloudId: credential.cloudId,
        });
        await upsertTenantConnectorUserExternalGroupMemberships({
          externalGroupIds: groupIds,
          sourceType: "confluence",
          tenantId: args.tenantId,
          userEmail: credential.userEmail,
        });
      }

      await removeStaleTenantConnectorExternalGroups({
        excludeSpaceGroups: true,
        sourceType: "confluence",
        tenantId: args.tenantId,
        userEmail: credential.userEmail,
      });
    }
  } else {
    await markTenantConnectorExternalGroupsStale({
      excludeSpaceGroups: true,
      sourceType: "confluence",
      tenantId: args.tenantId,
    });

    for (const credential of filtered) {
      const token = await ensureFreshConfluenceAccessToken({
        credentialId: credential.credentialId,
        tenantId: args.tenantId,
        userId: credential.userId,
      }).catch(() => null);
      if (!token) {
        continue;
      }

      const groupIds = await fetchConfluenceUserGroupIds({
        accessToken: token.accessToken,
        accountId: credential.accountId,
        cloudId: credential.cloudId,
      });
      await upsertTenantConnectorUserExternalGroupMemberships({
        externalGroupIds: groupIds,
        sourceType: "confluence",
        tenantId: args.tenantId,
        userEmail: credential.userEmail,
      });
    }

    await removeStaleTenantConnectorExternalGroups({
      excludeSpaceGroups: true,
      sourceType: "confluence",
      tenantId: args.tenantId,
    });
  }

  const rows = await listTenantConnectorExternalGroupMembershipRows({
    tenantId: args.tenantId,
  });
  return {
    membershipRows: rows.filter((row) => row.sourceType === "confluence")
      .length,
  };
}
