import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import {
  disconnectTenantSlackIntegration,
  getTenantSlackIntegrationAdminView,
  updateTenantSlackIntegrationSettings,
} from "@/core/lib/db/slack-integration-queries";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { getSlackIntegrationOAuthRedirectUri } from "@/core/lib/slack-integration/oauth";

const patchSchema = z.object({
  allowedChannelIds: z.array(z.string().max(64)).max(200).optional(),
  credentialMode: z.enum(["managed", "own"]).optional(),
  deliverablesEnabled: z.boolean().optional(),
  disconnect: z.boolean().optional(),
  dmsEnabled: z.boolean().optional(),
  enabled: z.boolean().optional(),
  oauthClientId: z.string().max(512).optional(),
  oauthClientSecret: z.string().optional(),
  signingSecret: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:slack-integration`,
    "admin.slack_integration"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const view = await getTenantSlackIntegrationAdminView(authResult.tenant.id);
  return Response.json(view);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:slack-integration`,
    "admin.slack_integration"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.disconnect) {
    await disconnectTenantSlackIntegration(authResult.tenant.id);
  } else {
    await updateTenantSlackIntegrationSettings(authResult.tenant.id, body);
  }

  await insertSecurityAuditEvent({
    action: body.disconnect
      ? "tenant.admin.slack_integration.disconnected"
      : "tenant.admin.slack_integration.updated",
    email: authResult.userEmail,
    ipAddress: getClientIpFromHeaders(request.headers) ?? null,
    resource: `admin:${tenantSlug}:slack-integration`,
    tenantId: authResult.tenant.id,
    userAgent: request.headers.get("user-agent"),
    userId: authResult.userId,
  });

  const view = await getTenantSlackIntegrationAdminView(authResult.tenant.id);
  return Response.json({
    ...view,
    oauthRedirectUri: getSlackIntegrationOAuthRedirectUri(),
  });
}
