import "dotenv/config";
import { config } from "dotenv";
import {
  createTenant,
  createTenantSetupToken,
  getTenantBySlug,
} from "@/core/lib/db/queries";
import { getSsoCallbackPath } from "@/shared/sso/providers";

config({ override: true, path: ".env.local" });

type CliArgs = {
  slug: string;
  name: string;
  domain: string;
  provider: "google_workspace" | "okta" | "azure_ad";
};

function normalizeProvider(rawProvider: string): CliArgs["provider"] {
  if (rawProvider === "google") {
    return "google_workspace";
  }
  if (
    rawProvider === "google_workspace" ||
    rawProvider === "okta" ||
    rawProvider === "azure_ad"
  ) {
    return rawProvider;
  }
  throw new Error(
    "provider must be one of: google, google_workspace, okta, azure_ad"
  );
}

function parseArgs(argv: string[]): CliArgs {
  const pairs = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key?.startsWith("--") && value) {
      pairs.set(key.slice(2), value);
    }
  }

  const slug = pairs.get("slug");
  const name = pairs.get("name");
  const domain = pairs.get("domain");
  const rawProvider = pairs.get("provider");

  if (!slug || !name || !domain || !rawProvider) {
    throw new Error(
      'Usage: pnpm sso:onboard --slug acme --name "Acme Inc" --domain acmeinc.com --provider google'
    );
  }

  const provider = normalizeProvider(rawProvider);

  return { domain, name, provider, slug };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const existing = await getTenantBySlug(args.slug);
  const tenant =
    existing ??
    (await createTenant({
      companyName: args.name,
      primaryDomain: args.domain,
      slug: args.slug,
    }));

  const { token, expiresAt } = await createTenantSetupToken({
    expiresInDays: 7,
    tenantId: tenant.id,
  });

  const appUrl =
    process.env.KIMIRO_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:5173";
  const setupUrl = `${appUrl}/setup?token=${token}&provider=${args.provider}`;
  const callbackUrl = `${appUrl}${getSsoCallbackPath(args.provider)}`;

  process.stdout.write(`Tenant: ${tenant.companyName} (${tenant.slug})\n`);
  process.stdout.write(`Provider: ${args.provider}\n`);
  process.stdout.write(`OAuth Redirect URL: ${callbackUrl}\n`);
  process.stdout.write(`Setup URL: ${setupUrl}\n`);
  process.stdout.write(`Token expires at: ${expiresAt.toISOString()}\n`);
  process.exit(0);
}

run().catch((error) => {
  if (error instanceof Error) {
    process.stderr.write(`${error.message}\n`);
    if (error.cause) {
      process.stderr.write(`cause: ${String(error.cause)}\n`);
    }
    process.stderr.write(`${error.stack ?? ""}\n`);
  } else {
    process.stderr.write(`${String(error)}\n`);
  }
  process.exit(1);
});
