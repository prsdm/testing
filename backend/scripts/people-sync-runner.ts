import { listActivePeopleSyncTenants } from "@/core/lib/db/queries";
import { runTenantPeopleSyncBySlug } from "@/core/lib/people-sync/orchestrator";

async function run() {
  const tenants = await listActivePeopleSyncTenants();
  for (const tenant of tenants) {
    try {
      await runTenantPeopleSyncBySlug(tenant.slug);
      process.stdout.write(`People sync succeeded for ${tenant.slug}\n`);
    } catch (error) {
      process.stderr.write(
        `People sync failed for ${tenant.slug}: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(
      `People sync runner failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exit(1);
  });
