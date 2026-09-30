import "dotenv/config";
import { listActivePeopleSyncTenants } from "@/core/lib/db/queries";
import { runTenantDriveIndexBySlug } from "@/core/lib/indexing/drive-orchestrator";

async function indexTenant(slugArg?: string) {
  const tenants = await listActivePeopleSyncTenants();
  const targets = slugArg
    ? tenants.filter((tenant) => tenant.slug === slugArg)
    : tenants;

  if (slugArg && targets.length === 0) {
    throw new Error(`No active tenant found with slug: ${slugArg}`);
  }

  for (const tenant of targets) {
    try {
      const result = await runTenantDriveIndexBySlug(tenant.slug);
      process.stdout.write(
        `Drive index for ${tenant.slug}: ${result.documentsIndexed} documents, ${result.chunksIndexed} chunks (run ${result.runId}).\n`
      );
    } catch (error) {
      process.stderr.write(
        `Drive index failed for ${tenant.slug}: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
    }
  }
}

const slug = process.argv[2];
indexTenant(slug)
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(
      `Drive index runner failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exit(1);
  });
