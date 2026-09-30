import { z } from "zod";
import {
  getTenantNotionActionsConfig,
  updateTenantNotionActionsSettings,
} from "@/core/lib/db/notion-actions-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

const patchSchema = z.object({
  allowRead: z.boolean().optional(),
  credentialMode: z.enum(["managed", "own"]).optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantAdmin(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const config = await getTenantNotionActionsConfig(authResult.tenant.id);
  return Response.json(config);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantAdmin(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  await updateTenantNotionActionsSettings(authResult.tenant.id, body);

  await insertSecurityAuditEvent({
    action: "tenant.integrations.notion_actions.updated",
    email: authResult.userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `integrations:${tenantSlug}:notion-actions`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const config = await getTenantNotionActionsConfig(authResult.tenant.id);
  return Response.json(config);
}
