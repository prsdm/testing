import { fetchTenantConnectorExternalGroupIdsForUser } from "@/core/lib/db/connector-membership-queries";
import {
  fetchTenantDriveExternalGroupIdsForUser,
  fetchTenantDrivePublicExternalGroupIds,
} from "@/core/lib/db/drive-membership-queries";
import { prefixExternalGroup, prefixUserEmail } from "@/core/lib/search/acl";
import { PUBLIC_DOC_PAT } from "@/core/lib/search/constants";
import { buildExtGroupNameForDrive } from "@/core/lib/search/google-drive/external-access";
import { buildExtGroupNameForSource } from "@/core/lib/sources/source-external-access";
import type { SourceConnectorType } from "@/shared/sources/source-types";

function kimiroUserToken(userId: string) {
  return `user:${userId}`;
}

function tenantToken(tenantId: string) {
  return `tenant:${tenantId}`;
}

/**
 * Expand the caller's ACL tokens from Postgres membership tables.
 * Document access is enforced by Postgres accessControlList + Vespa (Glean-style
 * permission mirroring). No separate permissions graph.
 */
export async function buildUserAclTokensFromMemberships(args: {
  tenantId: string;
  userId: string;
  userEmail: string;
}): Promise<string[]> {
  const [directGroupIds, publicGroupIds, connectorGroupIds] = await Promise.all(
    [
      fetchTenantDriveExternalGroupIdsForUser({
        tenantId: args.tenantId,
        userEmail: args.userEmail,
      }),
      fetchTenantDrivePublicExternalGroupIds(args.tenantId),
      fetchTenantConnectorExternalGroupIdsForUser({
        tenantId: args.tenantId,
        userEmail: args.userEmail,
      }),
    ]
  );

  const tokens = new Set<string>([
    prefixUserEmail(args.userEmail),
    kimiroUserToken(args.userId),
    tenantToken(args.tenantId),
    PUBLIC_DOC_PAT,
  ]);

  for (const groupId of [...directGroupIds, ...publicGroupIds]) {
    tokens.add(prefixExternalGroup(buildExtGroupNameForDrive(groupId)));
  }
  for (const row of connectorGroupIds) {
    const extName = buildExtGroupNameForSource(
      row.sourceType as SourceConnectorType,
      row.externalGroupId
    );
    if (extName) {
      tokens.add(prefixExternalGroup(extName));
    }
  }

  return [...tokens];
}

/** @deprecated Use buildUserAclTokensFromMemberships */
export const buildUserAclTokensFromPostgres = buildUserAclTokensFromMemberships;
