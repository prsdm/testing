import { execSync } from "node:child_process";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { migrationsFolder } from "@/migration/paths";

config({ path: ".env" });
config({ override: true, path: ".env.local" });

const DEFAULT_SLUG = "kimiro";
const DEFAULT_NAME = "Kimiro";
const DEFAULT_DOMAIN = "kimiro.ai";

function hasYesFlag() {
  return process.argv.includes("--yes");
}

function runDocker(command: string) {
  execSync(`docker compose ${command}`, { stdio: "inherit" });
}

async function waitForPostgres(url: string, attempts = 45) {
  for (let i = 0; i < attempts; i += 1) {
    const connection = postgres(url, { connect_timeout: 3, max: 1 });
    try {
      await connection`SELECT 1`;
      await connection.end({ timeout: 2 });
      return;
    } catch {
      await connection.end({ timeout: 2 }).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error("Postgres did not become ready in time");
}

async function bootstrapTenant() {
  const [{ createTenant, createTenantSetupToken }] = await Promise.all([
    import("@/core/lib/db/queries"),
  ]);

  const slug = process.env.KIMI_TENANT_SLUG?.trim() || DEFAULT_SLUG;
  const name = process.env.KIMI_TENANT_NAME?.trim() || DEFAULT_NAME;
  const domain = process.env.KIMI_TENANT_DOMAIN?.trim() || DEFAULT_DOMAIN;
  const provider =
    (process.env.KIMI_SSO_PROVIDER?.trim() as
      | "google_workspace"
      | "okta"
      | "azure_ad"
      | undefined) ?? "google_workspace";

  const tenant = await createTenant({
    companyName: name,
    primaryDomain: domain,
    slug,
  });

  const { token, expiresAt } = await createTenantSetupToken({
    expiresInDays: 7,
    tenantId: tenant.id,
  });

  const appUrl =
    process.env.KIMIRO_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:5173";
  const setupUrl = `${appUrl}/setup?token=${token}&provider=${provider}`;

  process.stdout.write("\n--- Local reset complete ---\n");
  process.stdout.write(`Tenant: ${name} (${slug})\n`);
  process.stdout.write(`Domain: ${domain}\n`);
  process.stdout.write(`Setup URL: ${setupUrl}\n`);
  process.stdout.write(`Token expires: ${expiresAt.toISOString()}\n`);
  process.stdout.write("\nStart app:\n");
  process.stdout.write(
    "  docker compose up -d model_server indexing_model_server\n"
  );
  process.stdout.write("  pnpm dev\n");
  process.stdout.write("\nAfter adding Sources items:\n");
  process.stdout.write("  pnpm sources:reindex        # Vespa search index\n");
  process.stdout.write(
    "  pnpm sources:acl:repair     # optional grant/membership repair\n"
  );
}

async function run() {
  if (!hasYesFlag()) {
    process.stderr.write(
      "This deletes local Postgres, Vespa, and model-server Docker volumes (all tenants, chats, indexes, embedding caches).\n"
    );
    process.stderr.write(
      "Docker images are kept (only containers/volumes are reset).\n"
    );
    process.stderr.write("Run: pnpm local:reset -- --yes\n");
    process.exit(1);
  }

  const postgresUrl = process.env.POSTGRES_URL?.trim();
  if (!postgresUrl) {
    throw new Error("POSTGRES_URL is required");
  }

  process.stdout.write("Stopping Docker services and removing volumes...\n");
  runDocker(
    "down -v relational_db cache vespa model_server indexing_model_server"
  );

  process.stdout.write(
    "Starting Postgres, Redis, Vespa, and model servers...\n"
  );
  runDocker(
    "up -d relational_db cache vespa model_server indexing_model_server"
  );

  process.stdout.write(
    "Waiting for Vespa and deploying application schema...\n"
  );
  execSync("pnpm vespa:deploy -- --skip-sources-reindex", { stdio: "inherit" });

  process.stdout.write("Waiting for Postgres...\n");
  await waitForPostgres(postgresUrl);

  process.stdout.write("Running database migrations...\n");
  const connection = postgres(postgresUrl, { max: 1 });
  const db = drizzle(connection);
  try {
    await migrate(db, {
      migrationsFolder,
    });
  } finally {
    await connection.end({ timeout: 5 });
  }

  process.stdout.write("Creating tenant...\n");
  await bootstrapTenant();
}

run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
