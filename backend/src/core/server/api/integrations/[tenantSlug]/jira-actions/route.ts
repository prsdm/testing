import { z } from "zod";
import {
  getTenantJiraActionsConfig,
  updateTenantJiraActionsSettings,
} from "@/core/lib/db/jira-actions-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

const patchSchema = z.object({
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

  const config = await getTenantJiraActionsConfig(authResult.tenant.id);
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

  await updateTenantJiraActionsSettings(authResult.tenant.id, body);

  await insertSecurityAuditEvent({
    action: "tenant.integrations.jira_actions.updated",
    email: authResult.userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `integrations:${tenantSlug}:jira-actions`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const config = await getTenantJiraActionsConfig(authResult.tenant.id);
  return Response.json(config);
}
