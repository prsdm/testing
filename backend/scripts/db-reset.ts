import "dotenv/config";
import { config } from "dotenv";
import postgres from "postgres";

config({ override: true, path: ".env.local" });

const CORE_TABLES = [
  "TenantIdentity",
  "TenantSetupToken",
  "TenantSSOConfig",
  "TenantAdminContact",
  "TenantDomain",
  "Tenant",
] as const;

const AUTH_TABLES = [
  "session",
  "account",
  "verification",
  "user",
  "ssoProvider",
] as const;

function hasYesFlag() {
  return process.argv.includes("--yes");
}

async function findExistingTables(
  sql: postgres.Sql,
  tableNames: readonly string[]
) {
  const existing: string[] = [];

  for (const tableName of tableNames) {
    const rows = await sql<
      Array<{
        regclass: string | null;
      }>
    >`select to_regclass(${`public."${tableName}"`}) as regclass`;

    if (rows[0]?.regclass) {
      existing.push(tableName);
    }
  }

  return existing;
}

async function truncateTables(sql: postgres.Sql, tableNames: string[]) {
  if (tableNames.length === 0) {
    return;
  }

  const quotedTables = tableNames
    .map((tableName) => `"${tableName}"`)
    .join(", ");
  await sql.unsafe(`truncate table ${quotedTables} restart identity cascade`);
}

async function run() {
  if (!hasYesFlag()) {
    process.stderr.write(
      "Refusing to reset database data.\nRun with: pnpm db:reset -- --yes\n"
    );
    process.exit(1);
  }

  const postgresUrl = process.env.POSTGRES_URL;
  if (!postgresUrl) {
    process.stderr.write("POSTGRES_URL is required.\n");
    process.exit(1);
  }

  const sql = postgres(postgresUrl, { max: 1 });

  try {
    const coreExisting = await findExistingTables(sql, CORE_TABLES);
    const authExisting = await findExistingTables(sql, AUTH_TABLES);
    const allTables = [...coreExisting, ...authExisting];

    if (allTables.length === 0) {
      process.stdout.write("No database tables found to reset.\n");
      process.exit(0);
    }

    await truncateTables(sql, allTables);
    process.stdout.write(
      `Reset complete. Truncated tables: ${allTables.join(", ")}\n`
    );
    process.exit(0);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

run().catch((error) => {
  process.stderr.write(`Database reset failed: ${String(error)}\n`);
  process.exit(1);
});
