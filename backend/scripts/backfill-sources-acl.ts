import "dotenv/config";

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { tenants } from "@/core/lib/db/tables";
import { backfillTenantKnowledgeItemAccessControlLists } from "@/core/lib/sources/source-item-acl";

config({ override: true, path: ".env.local" });

const db = getDb();

async function main() {
  const slug = process.argv[2]?.trim();
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
    const result = await backfillTenantKnowledgeItemAccessControlLists({
      tenantId: tenant.id,
    });
    process.stdout.write(
      `[kb:acl:backfill] ${tenant.slug}: updated ${result.itemsUpdated} knowledge items, reindexed ${result.itemsReindexed} in Vespa\n`
    );
  }
}

main().catch((error) => {
  process.stderr.write(
    `KB ACL backfill failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
