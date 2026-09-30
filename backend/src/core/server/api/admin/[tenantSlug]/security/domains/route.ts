import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import {
  addTenantDomain,
  normalizeDomainInput,
} from "@/core/lib/db/security-admin-queries";
import { ChatbotError } from "@/shared/errors";

const addDomainBodySchema = z.object({
  domain: z.string().min(1).max(255),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:security:domains`,
    "admin.security"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof addDomainBodySchema>;
  try {
    body = addDomainBodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const created = await addTenantDomain({
      domain: normalizeDomainInput(body.domain),
      tenantId: authResult.tenant.id,
    });

    await insertSecurityAuditEvent({
      action: "tenant.admin.security.domains.add",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: { domain: created.domain },
      resource: `admin:${tenantSlug}:security:domains`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    return Response.json({
      domain: {
        createdAt: created.createdAt.toISOString(),
        domain: created.domain,
        id: created.id,
        verifiedAt: created.verifiedAt?.toISOString() ?? null,
      },
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
    return Response.json({ error: "Failed to add domain" }, { status: 500 });
  }
}
