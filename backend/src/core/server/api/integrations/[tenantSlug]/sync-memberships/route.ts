import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { runTenantDriveMembershipSyncBySlug } from "@/core/lib/indexing/drive-membership-orchestrator";
import { getClientIpFromHeaders } from "@/core/lib/security/sensitive-session";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantAdmin(tenantSlug, request);
  if ("error" in authz) {
    return authz.error;
  }
  const { tenant, userEmail, userId } = authz;

  try {
    const result = await runTenantDriveMembershipSyncBySlug(tenantSlug);
    await insertSecurityAuditEvent({
      action: "tenant.integrations.sync_memberships.triggered",
      email: userEmail,
      ipAddress: getClientIpFromHeaders(request.headers) ?? null,
      metadata: result,
      resource: `integrations:${tenantSlug}:sync-memberships`,
      tenantId: tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId,
    });
    return Response.json({ ok: true, result });
  } catch (error) {
    const detail =
      error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Failed to sync Google Drive memberships";
    return Response.json({ error: detail }, { status: 500 });
  }
}
