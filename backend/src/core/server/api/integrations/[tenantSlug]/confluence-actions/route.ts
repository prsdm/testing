import { z } from "zod";
import {
  getTenantConfluenceActionsConfig,
  updateTenantConfluenceActionsSettings,
} from "@/core/lib/db/confluence-actions-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

const patchSchema = z.object({
  allowRead: z.boolean().optional(),
  credentialMode: z.enum(["managed", "own"]).optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  siteUrl: z.string().optional(),
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

  const config = await getTenantConfluenceActionsConfig(authResult.tenant.id);
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

  await updateTenantConfluenceActionsSettings(authResult.tenant.id, body);
  await insertSecurityAuditEvent({
    action: "tenant.integrations.confluence_actions.updated",
    email: authResult.userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `integrations:${tenantSlug}:confluence-actions`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const config = await getTenantConfluenceActionsConfig(authResult.tenant.id);
  return Response.json(config);
}
