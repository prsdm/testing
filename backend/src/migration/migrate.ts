import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { backendRoot, migrationsFolder } from "./paths";

type MigrationJournal = {
  entries?: Array<{ tag?: string }>;
};

function loadDeveloperEnvironment() {
  const injectedPostgresUrl = process.env.POSTGRES_URL;
  config({ path: resolve(backendRoot, ".env") });
  config({ override: true, path: resolve(backendRoot, ".env.local") });
  if (injectedPostgresUrl !== undefined) {
    process.env.POSTGRES_URL = injectedPostgresUrl;
  }
}

async function validateMigrationsFolder() {
  const journalPath = resolve(migrationsFolder, "meta/_journal.json");
  const journal = JSON.parse(
    await readFile(journalPath, "utf8")
  ) as MigrationJournal;
  const entries = journal.entries ?? [];

  if (entries.length === 0) {
    throw new Error(`Migration journal has no entries: ${journalPath}`);
  }

  for (const entry of entries) {
    if (!entry.tag) {
      throw new Error("Migration journal contains an entry without a tag");
    }
    await stat(resolve(migrationsFolder, `${entry.tag}.sql`));
  }

  return entries.length;
}

async function run() {
  const migrationCount = await validateMigrationsFolder();
  if (process.argv.includes("--check")) {
    process.stdout.write(
      `Migration path valid: ${migrationsFolder} (${migrationCount} migrations)\n`
    );
    return;
  }

  if (!process.argv.includes("--no-env")) {
    loadDeveloperEnvironment();
  }
  const url = process.env.POSTGRES_URL?.trim();
  if (!url) {
    throw new Error(
      "POSTGRES_URL is required; no database migration was attempted"
    );
  }

  const connection = postgres(url, { max: 1 });
  const db = drizzle(connection);
  process.stdout.write(`Running migrations from ${migrationsFolder}...\n`);
  const start = Date.now();

  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await connection.end({ timeout: 5 });
  }

  process.stdout.write(`Migrations completed in ${Date.now() - start} ms\n`);
}

run().catch((error) => {
  process.stderr.write(
    `Migration failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
