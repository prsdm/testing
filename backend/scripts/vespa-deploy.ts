import "dotenv/config";
import { config } from "dotenv";
import {
  ensureVespaApplication,
  waitForVespaQueryReady,
} from "@/core/lib/search/vespa/deploy";
import { reindexTeamKbItemsInSearchForAllTenants } from "@/core/lib/sources/reindex-source-search";

config({ override: true, path: ".env.local" });

function shouldSkipSourcesReindex() {
  return (
    process.argv.includes("--skip-sources-reindex") ||
    process.argv.includes("--skip-kb-reindex")
  );
}

async function reindexSourcesIntoVespa() {
  process.stdout.write(
    "Reindexing Sources (Postgres team_source → Vespa) for all tenants...\n"
  );

  const results = await reindexTeamKbItemsInSearchForAllTenants();

  if (results.length === 0) {
    process.stdout.write("No tenants found; skipped sources reindex.\n");
    return;
  }

  let failedTenants = 0;
  for (const result of results) {
    const label = result.tenantSlug ?? result.tenantId;
    process.stdout.write(
      `  ${label}: removed ${result.vespaChunksRemoved} Vespa chunks, indexed ${result.itemsIndexed}/${result.itemsTotal} source items\n`
    );
    for (const error of result.errors) {
      process.stderr.write(`    ✗ ${error}\n`);
    }
    if (result.itemsFailed > 0) {
      failedTenants += 1;
    }
  }

  if (failedTenants > 0) {
    throw new Error(
      `Sources reindex failed for ${failedTenants} tenant(s). Start indexing_model_server (port 9001) via docker compose and run: pnpm sources:reindex`
    );
  }
}

async function main() {
  process.stdout.write("Deploying Vespa application package...\n");
  await ensureVespaApplication();
  await waitForVespaQueryReady();
  process.stdout.write(
    "Vespa application deployed and query endpoint is ready.\n"
  );

  if (shouldSkipSourcesReindex()) {
    process.stdout.write(
      "Skipped sources reindex (--skip-sources-reindex). Run: pnpm sources:reindex [tenantSlug]\n"
    );
    return;
  }

  await reindexSourcesIntoVespa();
  process.stdout.write("Sources reindex complete.\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
