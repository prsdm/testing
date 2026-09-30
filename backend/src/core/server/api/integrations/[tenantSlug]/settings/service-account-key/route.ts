import {
  getTenantPeopleProviderConfigBySlug,
  insertSecurityAuditEvent,
  updateTenantPeopleSettings,
} from "@/core/lib/db/queries";
import { updateTenantSearchSettings } from "@/core/lib/db/search-index-queries";
import { parseGoogleServiceAccountJson } from "@/core/lib/search/google-drive/parse-service-account-json";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

async function readServiceAccountJson(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { error: "Missing JSON file." as const };
    }
    if (
      file.type !== "application/json" &&
      !file.name.toLowerCase().endsWith(".json")
    ) {
      return { error: "Upload a .json file." as const };
    }
    return { raw: await file.text() };
  }

  if (contentType.includes("application/json")) {
    return { raw: await request.text() };
  }

  return {
    error: "Send multipart file upload or application/json body.",
  } as const;
}

export async function PUT(
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

  const bodyRead = await readServiceAccountJson(request);
  if ("error" in bodyRead) {
    return Response.json({ error: bodyRead.error }, { status: 400 });
  }

  const { parsed, error } = parseGoogleServiceAccountJson(bodyRead.raw);
  if (error || !parsed) {
    return Response.json(
      { error: error ?? "Invalid service account JSON." },
      {
        status: 400,
      }
    );
  }

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

  await Promise.all([
    updateTenantPeopleSettings({
      directoryConfig: {
        serviceAccountClientEmail: parsed.clientEmail,
        serviceAccountPrivateKey: parsed.privateKey,
      },
      peopleProvider,
      tenantId: tenant.id,
    }),
    updateTenantSearchSettings(tenant.id, { indexingEnabled: true }),
  ]);

  await insertSecurityAuditEvent({
    action: "tenant.integrations.service_account_key.uploaded",
    email: userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    metadata: { serviceAccountClientEmail: parsed.clientEmail },
    resource: `integrations:${tenantSlug}:service-account-key`,
    tenantId: tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId,
  });

  return Response.json({
    ok: true,
    serviceAccountClientEmail: parsed.clientEmail,
  });
}
