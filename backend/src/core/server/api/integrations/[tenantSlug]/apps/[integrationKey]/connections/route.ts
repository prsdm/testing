import { z } from "zod";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { assertIntegrationAdmin } from "@/core/lib/integrations/assert-integration-admin";
import {
  getIntegrationConnectionsForAdmin,
  removeIntegrationConnectionForUser,
} from "@/core/lib/integrations/integration-admin";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { ChatbotError } from "@/shared/errors";
import { isIntegrationKey } from "@/shared/integrations/integration-catalog";

const deleteSchema = z.object({
  authUserId: z.string().min(1),
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

  const connections = await getIntegrationConnectionsForAdmin(
    authResult.tenant.id,
    integrationKey
  );

  return Response.json({ connections });
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

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await removeIntegrationConnectionForUser(
      authResult.tenant.id,
      integrationKey,
      body.authUserId
    );
  } catch (error) {
    if (error instanceof ChatbotError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  await insertSecurityAuditEvent({
    action: "tenant.integrations.connection.removed",
    email: authResult.userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `integrations:${tenantSlug}:${integrationKey}:${body.authUserId}`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const connections = await getIntegrationConnectionsForAdmin(
    authResult.tenant.id,
    integrationKey
  );

  return Response.json({ connections });
}
