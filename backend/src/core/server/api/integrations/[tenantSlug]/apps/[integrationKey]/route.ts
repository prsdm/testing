import { z } from "zod";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { assertIntegrationAdmin } from "@/core/lib/integrations/assert-integration-admin";
import {
  getIntegrationAdminDetail,
  removeIntegrationSetup,
  saveIntegrationSetup,
} from "@/core/lib/integrations/integration-admin";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { ChatbotError } from "@/shared/errors";
import { isIntegrationKey } from "@/shared/integrations/integration-catalog";

const putSchema = z.object({
  availabilityMode: z.enum(["everyone", "selected"]),
  credentialMode: z.enum(["managed", "own"]),
  memberIds: z.array(z.string().uuid()),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  siteUrl: z.string().optional(),
});

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; integrationKey: string }> }
) {
  const { tenantSlug, integrationKey } = await params;
  if (!isIntegrationKey(integrationKey)) {
    return Response.json({ error: "Unknown integration" }, { status: 404 });
  }

  const authResult = await assertIntegrationAdmin(
    tenantSlug,
    request,
    integrationKey
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const detail = await getIntegrationAdminDetail(
    authResult.tenant.id,
    integrationKey
  );
  if (!detail) {
    return Response.json({ error: "Unknown integration" }, { status: 404 });
  }

  return Response.json(detail);
}

export async function PUT(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; integrationKey: string }> }
) {
  const { tenantSlug, integrationKey } = await params;
  if (!isIntegrationKey(integrationKey)) {
    return Response.json({ error: "Unknown integration" }, { status: 404 });
  }

  const authResult = await assertIntegrationAdmin(
    tenantSlug,
    request,
    integrationKey
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

  try {
    await saveIntegrationSetup(authResult.tenant.id, integrationKey, body);
  } catch (error) {
    if (error instanceof ChatbotError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  await insertSecurityAuditEvent({
    action: "tenant.integrations.setup.saved",
    email: authResult.userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `integrations:${tenantSlug}:${integrationKey}`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const detail = await getIntegrationAdminDetail(
    authResult.tenant.id,
    integrationKey
  );
  return Response.json(detail);
}

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; integrationKey: string }> }
) {
  const { tenantSlug, integrationKey } = await params;
  if (!isIntegrationKey(integrationKey)) {
    return Response.json({ error: "Unknown integration" }, { status: 404 });
  }

  const authResult = await assertIntegrationAdmin(
    tenantSlug,
    request,
    integrationKey
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    await removeIntegrationSetup(authResult.tenant.id, integrationKey);
  } catch (error) {
    if (error instanceof ChatbotError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  await insertSecurityAuditEvent({
    action: "tenant.integrations.setup.removed",
    email: authResult.userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `integrations:${tenantSlug}:${integrationKey}`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  return Response.json({ ok: true });
}
