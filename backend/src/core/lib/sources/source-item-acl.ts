import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { sourceAccessGrants, teamSources } from "@/core/lib/db/tables";
import {
  parseSourceExternalAccess,
  sourceExternalAccessToAclTokens,
} from "@/core/lib/sources/source-external-access";
import type { SourceConnectorType } from "@/shared/sources/source-types";

const db = getDb();

const EXTERNAL_ACL_SOURCE_TYPES = new Set<SourceConnectorType>([
  "drive",
  "confluence",
  "notion",
  "sharepoint",
]);

function kimiroUserToken(userId: string) {
  return `user:${userId}`;
}

function tenantAclToken(tenantId: string) {
  return `tenant:${tenantId}`;
}

type KnowledgeItemAclInput = {
  id: string;
  tenantId: string;
  sourceType: SourceConnectorType;
  visibility: "private" | "shared";
  sourceExternalAccess: unknown;
  createdByUserId: string | null;
  accessControlList?: string[] | null;
};

export async function buildKnowledgeItemAccessControlList(
  item: KnowledgeItemAclInput
): Promise<string[]> {
  const acl = new Set<string>();
  const parsedAccess = parseSourceExternalAccess(item.sourceExternalAccess);
  if (parsedAccess) {
    for (const token of sourceExternalAccessToAclTokens({
      access: parsedAccess,
      ownerUserId: item.createdByUserId,
      sourceType: item.sourceType,
      tenantId: item.tenantId,
    })) {
      acl.add(token);
    }
  }

  const grants = await db
    .select({
      principalId: sourceAccessGrants.principalId,
      principalType: sourceAccessGrants.principalType,
    })
    .from(sourceAccessGrants)
    .where(
      and(
        eq(sourceAccessGrants.tenantId, item.tenantId),
        eq(sourceAccessGrants.sourceItemId, item.id)
      )
    );

  for (const grant of grants) {
    if (grant.principalType === "tenant" && !grant.principalId) {
      if (EXTERNAL_ACL_SOURCE_TYPES.has(item.sourceType)) {
        continue;
      }
      acl.add(tenantAclToken(item.tenantId));
      continue;
    }
    if (grant.principalType === "user" && grant.principalId) {
      acl.add(kimiroUserToken(grant.principalId));
    }
  }

  if (item.createdByUserId) {
    acl.add(kimiroUserToken(item.createdByUserId));
  }

  return [...acl];
}

export async function persistKnowledgeItemAccessControlList(args: {
  tenantId: string;
  itemId: string;
  accessControlList: string[];
}) {
  await db
    .update(teamSources)
    .set({
      accessControlList: args.accessControlList,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(teamSources.tenantId, args.tenantId),
        eq(teamSources.id, args.itemId)
      )
    );
}

export async function refreshKnowledgeItemAccessControlList(
  item: KnowledgeItemAclInput
) {
  const accessControlList = await buildKnowledgeItemAccessControlList(item);
  await persistKnowledgeItemAccessControlList({
    accessControlList,
    itemId: item.id,
    tenantId: item.tenantId,
  });
  return accessControlList;
}

export async function backfillTenantKnowledgeItemAccessControlLists(args: {
  tenantId: string;
}) {
  const { indexTeamKbItemInSearch } = await import(
    "@/core/lib/sources/source-chunk-index"
  );

  const items = await db
    .select()
    .from(teamSources)
    .where(eq(teamSources.tenantId, args.tenantId));

  let updated = 0;
  let reindexed = 0;
  for (const item of items) {
    const previousAcl = [...(item.accessControlList ?? [])].sort();
    const accessControlList = await refreshKnowledgeItemAccessControlList(item);
    const nextAcl = [...accessControlList].sort();
    const aclChanged =
      previousAcl.length !== nextAcl.length ||
      previousAcl.some((token, index) => token !== nextAcl.at(index));

    updated += 1;
    if (aclChanged) {
      await indexTeamKbItemInSearch({
        ...item,
        accessControlList,
      });
      reindexed += 1;
    }
  }
  return {
    itemsReindexed: reindexed,
    itemsUpdated: updated,
    tenantId: args.tenantId,
  };
}
