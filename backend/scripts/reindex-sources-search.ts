import "dotenv/config";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { tenants } from "@/core/lib/db/tables";
import {
  reindexTeamKbItemsInSearchForAllTenants,
  reindexTeamKbItemsInSearchForTenant,
} from "@/core/lib/sources/reindex-source-search";

config({ override: true, path: ".env.local" });

async function run() {
  const slug = process.argv[2]?.trim();

  if (slug) {
    const [tenant] = await getDb()
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (!tenant) {
      throw new Error(`Tenant not found: ${slug}`);
    }

    const result = await reindexTeamKbItemsInSearchForTenant(tenant.id);
    process.stdout.write(
      `[kb:reindex] ${slug}: removed ${result.vespaChunksRemoved} Vespa chunks, indexed ${result.itemsIndexed}/${result.itemsTotal} KB items\n`
    );
    for (const error of result.errors) {
      process.stderr.write(`  ✗ ${error}\n`);
    }
    process.exit(result.itemsFailed > 0 ? 1 : 0);
  }

  const results = await reindexTeamKbItemsInSearchForAllTenants();
  if (results.length === 0) {
    process.stdout.write("No tenants found.\n");
    process.exit(0);
  }

  let failedTenants = 0;
  for (const result of results) {
    const label = result.tenantSlug ?? result.tenantId;
    process.stdout.write(
      `[kb:reindex] ${label}: removed ${result.vespaChunksRemoved} Vespa chunks, indexed ${result.itemsIndexed}/${result.itemsTotal} KB items\n`
    );
    for (const error of result.errors) {
      process.stderr.write(`  ✗ ${error}\n`);
    }
    if (result.itemsFailed > 0) {
      failedTenants += 1;
    }
  }

  process.exit(failedTenants > 0 ? 1 : 0);
}

run().catch((error) => {
  if (error instanceof Error && error.cause) {
    process.stderr.write(`Cause: ${String(error.cause)}\n`);
  }
  process.stderr.write(
    `KB reindex failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
