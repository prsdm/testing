import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { sourceAccessGrants, teamSources } from "@/core/lib/db/tables";
import { parseSourceExternalAccess } from "@/core/lib/sources/source-external-access";

const db = getDb();

/** Remove tenant-wide viewer grants on connector docs that are not tenant-public. */
export async function repairExternalConnectorBroadGrants(args: {
  tenantId: string;
}): Promise<{ removedTenantGrants: number }> {
  const externalItems = await db
    .select({
      id: teamSources.id,
      sourceExternalAccess: teamSources.sourceExternalAccess,
    })
    .from(teamSources)
    .where(
      and(
        eq(teamSources.tenantId, args.tenantId),
        inArray(teamSources.sourceType, [
          "drive",
          "confluence",
          "notion",
          "sharepoint",
        ]),
        eq(teamSources.visibility, "shared")
      )
    );

  const itemIdsToRepair = externalItems
    .filter((item) => {
      const parsed = parseSourceExternalAccess(item.sourceExternalAccess);
      return !parsed?.isTenantPublic;
    })
    .map((item) => item.id);

  if (itemIdsToRepair.length === 0) {
    return { removedTenantGrants: 0 };
  }

  const deleted = await db
    .delete(sourceAccessGrants)
    .where(
      and(
        eq(sourceAccessGrants.tenantId, args.tenantId),
        inArray(sourceAccessGrants.sourceItemId, itemIdsToRepair),
        eq(sourceAccessGrants.principalType, "tenant"),
        sql`${sourceAccessGrants.principalId} IS NULL`,
        eq(sourceAccessGrants.role, "viewer")
      )
    )
    .returning({ id: sourceAccessGrants.id });

  return { removedTenantGrants: deleted.length };
}
