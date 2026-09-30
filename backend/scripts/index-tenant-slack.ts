import "dotenv/config";
import { listActivePeopleSyncTenants } from "@/core/lib/db/queries";
import { runTenantSlackIndexBySlug } from "@/core/lib/indexing/slack-orchestrator";

function parseArgs(argv: string[]) {
  let slug: string | undefined;
  let preferredUserId: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--userId=")) {
      preferredUserId = arg.slice("--userId=".length).trim() || undefined;
      continue;
    }
    if (!arg.startsWith("--") && !slug) {
      slug = arg;
    }
  }
  return { preferredUserId, slug };
}

async function indexTenant(slugArg?: string, preferredUserId?: string) {
  const tenants = await listActivePeopleSyncTenants();
  const targets = slugArg
    ? tenants.filter((tenant) => tenant.slug === slugArg)
    : tenants;

  if (slugArg && targets.length === 0) {
    throw new Error(`No active tenant found with slug: ${slugArg}`);
  }

  for (const tenant of targets) {
    try {
      const result = await runTenantSlackIndexBySlug(tenant.slug, {
        preferredUserId,
      });
      process.stdout.write(
        `Slack reindex for ${tenant.slug}: ${result.documentsIndexed} documents, ${result.chunksIndexed} chunks across ${result.listedChannels} Knowledge-selected channels (${result.unchangedChannels} unchanged, ${result.skippedChannels} skipped; run ${result.runId}).\n`
      );
    } catch (error) {
      process.stderr.write(
        `Slack index failed for ${tenant.slug}: ${
          error instanceof Error ? error.message : String(error)
        }\n`
      );
    }
  }
}

const { slug, preferredUserId } = parseArgs(process.argv.slice(2));
indexTenant(slug, preferredUserId)
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(
      `Slack index runner failed: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exit(1);
  });
