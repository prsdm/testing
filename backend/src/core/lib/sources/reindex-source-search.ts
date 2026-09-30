import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { teamSources, tenants } from "@/core/lib/db/tables";
import { deleteChunksForTenantSource } from "@/core/lib/search/chunk-index";
import { getTenantIndexName } from "@/core/lib/search/config";
import { indexTeamKbItemInSearch } from "@/core/lib/sources/source-chunk-index";

const db = getDb();

export type KbSearchReindexResult = {
  tenantId: string;
  tenantSlug?: string;
  itemsTotal: number;
  itemsIndexed: number;
  itemsFailed: number;
  vespaChunksRemoved: number;
  errors: string[];
};

function listTeamKbItemsForTenant(tenantId: string) {
  return db
    .select()
    .from(teamSources)
    .where(eq(teamSources.tenantId, tenantId))
    .orderBy(teamSources.updatedAt);
}

export async function reindexTeamKbItemsInSearchForTenant(
  tenantId: string
): Promise<KbSearchReindexResult> {
  const items = await listTeamKbItemsForTenant(tenantId);
  const indexName = getTenantIndexName(tenantId);
  const removed = await deleteChunksForTenantSource({
    indexName,
    sourceType: "team_source",
    tenantId,
  });

  const errors: string[] = [];
  let itemsIndexed = 0;

  for (const item of items) {
    try {
      await indexTeamKbItemInSearch(item);
      itemsIndexed += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to index KB item";
      errors.push(`${item.id} (${item.title}): ${message}`);
    }
  }

  return {
    errors,
    itemsFailed: items.length - itemsIndexed,
    itemsIndexed,
    itemsTotal: items.length,
    tenantId,
    vespaChunksRemoved: removed.deleted,
  };
}

export async function reindexTeamKbItemsInSearchForAllTenants(): Promise<
  KbSearchReindexResult[]
> {
  const tenantRows = await db
    .select({ id: tenants.id, slug: tenants.slug })
    .from(tenants);

  const results: KbSearchReindexResult[] = [];
  for (const tenant of tenantRows) {
    const result = await reindexTeamKbItemsInSearchForTenant(tenant.id);
    results.push({ ...result, tenantSlug: tenant.slug });
  }
  return results;
}
