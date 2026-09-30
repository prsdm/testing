import "dotenv/config";

import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { tenants } from "@/core/lib/db/tables";
import { syncTenantConfluenceMemberships } from "@/core/lib/sources/confluence-membership-sync";
import { repairExternalConnectorBroadGrants } from "@/core/lib/sources/repair-broad-grants";
import { syncTenantSharePointMemberships } from "@/core/lib/sources/sharepoint-membership-sync";

const db = getDb();

/** Repair over-broad grants and refresh connector memberships (no Nebula). */
async function main() {
  const slug = process.argv[2]?.trim();
  const tenantRows = slug
    ? await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    : await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants);

  if (tenantRows.length === 0) {
    throw new Error(slug ? `Tenant not found: ${slug}` : "No tenants found.");
  }

  for (const tenant of tenantRows) {
    try {
      await syncTenantConfluenceMemberships({ tenantId: tenant.id });
    } catch (error) {
      process.stderr.write(
        `[kb-acl] ${tenant.slug}: confluence membership sync failed: ${String(error)}\n`
      );
    }
    try {
      await syncTenantSharePointMemberships({ tenantId: tenant.id });
    } catch (error) {
      process.stderr.write(
        `[kb-acl] ${tenant.slug}: sharepoint membership sync failed: ${String(error)}\n`
      );
    }

    const repair = await repairExternalConnectorBroadGrants({
      tenantId: tenant.id,
    });
    process.stdout.write(
      `[kb-acl] ${tenant.slug}: removed ${repair.removedTenantGrants} broad tenant grants\n`
    );
  }
}

main().catch((error) => {
  process.stderr.write(`KB ACL repair failed: ${String(error)}\n`);
  process.exit(1);
});
