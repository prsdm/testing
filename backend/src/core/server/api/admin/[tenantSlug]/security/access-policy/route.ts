import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  insertSecurityAuditEvent,
  updateTenantAllowedOrgUnits,
} from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";

const accessPolicyBodySchema = z.object({
  allowedOrgUnits: z.array(z.string().trim().min(1).max(512)).max(200),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:security:access-policy`,
    "admin.security"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof accessPolicyBodySchema>;
  try {
    body = accessPolicyBodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    await updateTenantAllowedOrgUnits({
      allowedOrgUnits: body.allowedOrgUnits,
      tenantId: authResult.tenant.id,
    });

    await insertSecurityAuditEvent({
      action: "tenant.admin.security.access_policy.updated",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: { allowedOrgUnits: body.allowedOrgUnits },
      resource: `admin:${tenantSlug}:security:access-policy`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    return Response.json({
      allowedOrgUnits: body.allowedOrgUnits,
      ok: true,
    });
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
    return Response.json(
      { error: "Failed to update access policy" },
      { status: 500 }
    );
  }
}
