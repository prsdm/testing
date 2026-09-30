import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import {
  getTenantById,
  getTenantPeopleProviderConfigBySlug,
} from "@/core/lib/db/queries";
import { listTeamKbItemsForAclRefresh } from "@/core/lib/db/source-queries";
import { tenants } from "@/core/lib/db/tables";
import { parseDirectoryCredentials } from "@/core/lib/search/google-drive/client";
import { syncTenantDriveMemberships } from "@/core/lib/search/google-drive/membership-sync";
import { syncTenantConfluenceMemberships } from "@/core/lib/sources/confluence-membership-sync";
import { refreshTeamKbItemSourceExternalAccess } from "@/core/lib/sources/refresh-team-source-item-acl";
import { syncTenantSharePointMemberships } from "@/core/lib/sources/sharepoint-membership-sync";
import { backfillTenantKnowledgeItemAccessControlLists } from "@/core/lib/sources/source-item-acl";

const db = getDb();
const DEFAULT_BATCH_SIZE = 200;

export type TenantAclRefreshResult = {
  tenantId: string;
  tenantSlug: string;
  memberships: {
    driveMembershipRows: number | null;
    confluenceMembershipRows: number | null;
    sharepointMembershipRows: number | null;
  };
  itemsChecked: number;
  itemsUpdated: number;
  itemsUnchanged: number;
  itemsSkipped: number;
  itemsFailed: number;
};

async function refreshDriveMembershipsForTenant(args: {
  tenantId: string;
  tenantSlug: string;
  primaryDomain: string | null;
}) {
  const providerConfig = await getTenantPeopleProviderConfigBySlug(
    args.tenantSlug
  );
  const credentials = parseDirectoryCredentials(providerConfig?.metadata);
  const googleDomain =
    credentials?.domain?.trim().toLowerCase() ||
    args.primaryDomain?.trim().toLowerCase() ||
    "";
  if (!googleDomain) {
    return null;
  }

  const result = await syncTenantDriveMemberships({
    credentials,
    googleDomain,
    tenantId: args.tenantId,
  });
  return result.membershipRows;
}

export async function refreshTenantKnowledgeAcls(args: {
  tenantId: string;
  tenantSlug?: string;
  batchSize?: number;
}): Promise<TenantAclRefreshResult> {
  const tenant = await getTenantById(args.tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found: ${args.tenantId}`);
  }

  const tenantSlug = args.tenantSlug ?? tenant.slug;
  const batchSize = args.batchSize ?? DEFAULT_BATCH_SIZE;

  const driveMembershipRows = await refreshDriveMembershipsForTenant({
    primaryDomain: tenant.primaryDomain,
    tenantId: tenant.id,
    tenantSlug,
  }).catch(() => null);

  const confluenceMembership = await syncTenantConfluenceMemberships({
    tenantId: tenant.id,
  }).catch(() => null);

  const sharepointMembership = await syncTenantSharePointMemberships({
    tenantId: tenant.id,
  }).catch(() => null);

  const items = await listTeamKbItemsForAclRefresh({
    limit: batchSize,
    tenantId: tenant.id,
  });

  let itemsUpdated = 0;
  let itemsUnchanged = 0;
  let itemsSkipped = 0;
  let itemsFailed = 0;

  for (const item of items) {
    const result = await refreshTeamKbItemSourceExternalAccess({
      item,
      tenantSlug,
    }).catch(() => "failed" as const);
    if (result === "updated") {
      itemsUpdated += 1;
    } else if (result === "unchanged") {
      itemsUnchanged += 1;
    } else if (result === "skipped") {
      itemsSkipped += 1;
    } else {
      itemsFailed += 1;
    }
  }

  try {
    await backfillTenantKnowledgeItemAccessControlLists({
      tenantId: tenant.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[kb-acl-refresh] acl-backfill tenant=${tenant.id}: ${message}\n`
    );
  }

  return {
    itemsChecked: items.length,
    itemsFailed,
    itemsSkipped,
    itemsUnchanged,
    itemsUpdated,
    memberships: {
      confluenceMembershipRows: confluenceMembership?.membershipRows ?? null,
      driveMembershipRows,
      sharepointMembershipRows: sharepointMembership?.membershipRows ?? null,
    },
    tenantId: tenant.id,
    tenantSlug,
  };
}

export async function refreshKnowledgeAclsForAllTenants(args?: {
  batchSize?: number;
}) {
  const tenantRows = await db
    .select({ id: tenants.id, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.status, "active"));

  const results: TenantAclRefreshResult[] = [];
  for (const tenant of tenantRows) {
    const result = await refreshTenantKnowledgeAcls({
      batchSize: args?.batchSize,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    }).catch(() => null);
    if (result) {
      results.push(result);
    }
  }
  return results;
}
