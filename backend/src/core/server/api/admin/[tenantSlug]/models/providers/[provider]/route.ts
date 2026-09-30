import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { testLlmProviderConnection } from "@/core/lib/ai/test-llm-connection";
import {
  deleteTenantLlmProvider,
  getTenantLlmAdminView,
  getTenantLlmProviderApiKey,
  upsertTenantLlmProvider,
} from "@/core/lib/db/llm-provider-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import {
  isWellKnownLlmProvider,
  type WellKnownLlmProvider,
} from "@/shared/ai/llm-providers";

const putSchema = z.object({
  apiBase: z.string().nullable().optional(),
  apiKey: z.string().optional(),
  clearApiKey: z.boolean().optional(),
  testConnection: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; provider: string }> }
) {
  const { tenantSlug, provider: providerParam } = await params;
  if (!isWellKnownLlmProvider(providerParam)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }
  const provider = providerParam as WellKnownLlmProvider;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:models:${provider}`,
    "admin.models"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof putSchema>;
  try {
    body = putSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.testConnection) {
    const candidateKey =
      body.apiKey?.trim() ||
      (await getTenantLlmProviderApiKey(authResult.tenant.id, provider));
    if (!candidateKey) {
      return Response.json(
        { error: "API key is required to test" },
        { status: 400 }
      );
    }
    try {
      await testLlmProviderConnection({
        apiBase: body.apiBase,
        apiKey: candidateKey,
        provider,
      });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Connection test failed",
        },
        { status: 400 }
      );
    }
  }

  await upsertTenantLlmProvider(authResult.tenant.id, {
    apiBase: body.apiBase,
    apiKey: body.apiKey,
    clearApiKey: body.clearApiKey,
    provider,
  });

  await insertSecurityAuditEvent({
    action: "tenant.admin.models.provider.updated",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:models:${provider}`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const view = await getTenantLlmAdminView(authResult.tenant.id);
  return Response.json(view);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; provider: string }> }
) {
  const { tenantSlug, provider: providerParam } = await params;
  if (!isWellKnownLlmProvider(providerParam)) {
    return Response.json({ error: "Unknown provider" }, { status: 400 });
  }
  const provider = providerParam as WellKnownLlmProvider;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:models:${provider}`,
    "admin.models"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  await deleteTenantLlmProvider(authResult.tenant.id, provider);

  await insertSecurityAuditEvent({
    action: "tenant.admin.models.provider.deleted",
    email: authResult.userEmail,
    ipAddress: authResult.ipAddress,
    resource: `admin:${tenantSlug}:models:${provider}`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const view = await getTenantLlmAdminView(authResult.tenant.id);
  return Response.json(view);
}
