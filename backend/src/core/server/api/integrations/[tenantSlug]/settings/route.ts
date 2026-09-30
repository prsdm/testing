import { z } from "zod";
import {
  getTenantPeopleProviderConfigBySlug,
  insertSecurityAuditEvent,
  updateTenantPeopleSettings,
} from "@/core/lib/db/queries";
import { updateTenantSearchSettings } from "@/core/lib/db/search-index-queries";
import { getDriveIndexEligibility } from "@/core/lib/integrations/drive-index-eligibility";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

const bodySchema = z.object({
  delegatedAdminEmail: z.string().optional(),
  domain: z.string().optional(),
  serviceAccountClientEmail: z.string().optional(),
  serviceAccountPrivateKey: z.string().optional(),
});

function readDirectory(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const directory = (metadata as { directory?: unknown }).directory;
  if (!directory || typeof directory !== "object" || Array.isArray(directory)) {
    return {};
  }
  return directory as Record<string, unknown>;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantAdmin(tenantSlug, request);
  if ("error" in authz) {
    return authz.error;
  }
  const { tenant } = authz;

  const eligibility = await getDriveIndexEligibility({
    primaryDomain: tenant.primaryDomain,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  });

  return Response.json({
    canIndex: eligibility.canIndex,
    directory: {
      delegatedAdminEmail: eligibility.credentials.delegatedAdminEmail,
      domain: eligibility.credentials.domain,
      hasPrivateKey: eligibility.credentials.hasPrivateKey,
      serviceAccountClientEmail:
        eligibility.credentials.serviceAccountClientEmail,
    },
    driveReady: eligibility.driveReady,
    envAllowsIndexing: eligibility.envAllowsIndexing,
    indexingEnabled: eligibility.indexingEnabled,
    primaryDomain: tenant.primaryDomain,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantAdmin(tenantSlug, request);
  if ("error" in authz) {
    return authz.error;
  }
  const { tenant, userEmail, userId } = authz;

  const providerConfig = await getTenantPeopleProviderConfigBySlug(tenantSlug);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existingDirectory = readDirectory(providerConfig?.metadata);
  const existingPrivateKey =
    typeof existingDirectory.serviceAccountPrivateKey === "string"
      ? existingDirectory.serviceAccountPrivateKey
      : undefined;

  const metadata =
    providerConfig?.metadata &&
    typeof providerConfig.metadata === "object" &&
    !Array.isArray(providerConfig.metadata)
      ? (providerConfig.metadata as {
          peopleSync?: { provider?: "google_workspace" | "okta" | "azure_ad" };
        })
      : null;
  const peopleProvider =
    metadata?.peopleSync?.provider ??
    providerConfig?.provider ??
    "google_workspace";

  const directoryConfig: {
    domain?: string;
    delegatedAdminEmail?: string;
    serviceAccountClientEmail?: string;
    serviceAccountPrivateKey?: string;
  } = {};

  const domain = body.domain?.trim() || tenant.primaryDomain;
  if (domain) {
    directoryConfig.domain = domain;
  }
  const delegatedAdminEmail = body.delegatedAdminEmail?.trim();
  if (delegatedAdminEmail) {
    directoryConfig.delegatedAdminEmail = delegatedAdminEmail;
  }
  const serviceAccountClientEmail = body.serviceAccountClientEmail?.trim();
  if (serviceAccountClientEmail) {
    directoryConfig.serviceAccountClientEmail = serviceAccountClientEmail;
  }
  const serviceAccountPrivateKey = body.serviceAccountPrivateKey?.trim();
  if (serviceAccountPrivateKey) {
    directoryConfig.serviceAccountPrivateKey = serviceAccountPrivateKey;
  } else if (existingPrivateKey) {
    directoryConfig.serviceAccountPrivateKey = existingPrivateKey;
  }

  await Promise.all([
    updateTenantPeopleSettings({
      directoryConfig,
      peopleProvider,
      tenantId: tenant.id,
    }),
    updateTenantSearchSettings(tenant.id, { indexingEnabled: true }),
  ]);

  await insertSecurityAuditEvent({
    action: "tenant.integrations.settings.updated",
    email: userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `integrations:${tenantSlug}:settings`,
    tenantId: tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId,
  });

  return Response.json({ ok: true });
}
