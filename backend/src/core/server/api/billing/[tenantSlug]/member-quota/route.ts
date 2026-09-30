import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import {
  resetAllTenantMemberUsageQuotas,
  setTenantMemberUsageQuota,
} from "@/core/lib/db/usage-queries";

const bodySchema = z.union([
  z.object({
    resetAll: z.literal(true),
  }),
  z.object({
    authUserId: z.string().min(1),
    /** null resets to per-seat default. */
    monthlyQuotaUsdCents: z.number().int().min(0).nullable(),
  }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `billing:${tenantSlug}:member-quota`,
    "admin.billing"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    if ("resetAll" in body) {
      await resetAllTenantMemberUsageQuotas(authResult.tenant.id);

      await insertSecurityAuditEvent({
        action: "tenant.billing.member_quotas_reset",
        email: authResult.userEmail,
        ipAddress: authResult.ipAddress,
        metadata: { resetAll: true },
        resource: `billing:${tenantSlug}:member-quota`,
        tenantId: authResult.tenant.id,
        userAgent: request.headers.get("user-agent"),
        userId: authResult.userId,
      });

      return Response.json({ ok: true, resetAll: true });
    }

    const result = await setTenantMemberUsageQuota({
      authUserId: body.authUserId,
      monthlyQuotaUsdCents: body.monthlyQuotaUsdCents,
      tenantId: authResult.tenant.id,
    });

    await insertSecurityAuditEvent({
      action: "tenant.billing.member_quota_updated",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: {
        authUserId: body.authUserId,
        isCustomQuota: result.isCustomQuota,
        monthlyQuotaUsdCents: result.monthlyQuotaUsdCents,
      },
      resource: `billing:${tenantSlug}:member-quota`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update quota.";
    return Response.json({ error: message }, { status: 400 });
  }
}
