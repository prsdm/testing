import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { removeTenantDomain } from "@/core/lib/db/security-admin-queries";
import { ChatbotError } from "@/shared/errors";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; domainId: string }> }
) {
  const { tenantSlug, domainId } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:security:domains`,
    "admin.security"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const removed = await removeTenantDomain({
      domainId,
      primaryDomain: authResult.tenant.primaryDomain,
      tenantId: authResult.tenant.id,
    });

    await insertSecurityAuditEvent({
      action: "tenant.admin.security.domains.remove",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: { domain: removed.domain },
      resource: `admin:${tenantSlug}:security:domains`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return Response.json(
        {
          error:
            typeof error.cause === "string" && error.cause
              ? error.cause
              : error.message,
        },
        { status: 400 }
      );
    }
    return Response.json({ error: "Failed to remove domain" }, { status: 500 });
  }
}
