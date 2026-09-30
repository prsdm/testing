import "dotenv/config";

import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { tenants } from "@/core/lib/db/tables";
import { refreshTenantKnowledgeAcls } from "@/core/lib/sources/acl-refresh-orchestrator";

const db = getDb();

async function main() {
  const slug = process.argv[2]?.trim();
  const batchSizeArg = process.argv[3]?.trim();
  const batchSize = batchSizeArg
    ? Number.parseInt(batchSizeArg, 10)
    : undefined;

  const tenantRows = slug
    ? await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    : await db
        .select({ id: tenants.id, slug: tenants.slug })
        .from(tenants)
        .where(eq(tenants.status, "active"));

  if (tenantRows.length === 0) {
    throw new Error(slug ? `Tenant not found: ${slug}` : "No tenants found.");
  }

  for (const tenant of tenantRows) {
    const result = await refreshTenantKnowledgeAcls({
      batchSize,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
    });
    process.stdout.write(
      `[kb-acl-refresh] ${tenant.slug}: checked=${result.itemsChecked} updated=${result.itemsUpdated} unchanged=${result.itemsUnchanged} skipped=${result.itemsSkipped} failed=${result.itemsFailed}\n`
    );
  }
}

main().catch((error) => {
  process.stderr.write(`KB ACL refresh failed: ${String(error)}\n`);
  process.exit(1);
});
