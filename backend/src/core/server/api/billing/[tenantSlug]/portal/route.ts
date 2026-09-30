import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { getAppBaseUrl, getStripe } from "@/core/lib/billing/stripe";
import { getTenantBilling } from "@/core/lib/db/billing-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const bodySchema = z
  .object({
    flow: z.enum(["payment_method_update"]).optional(),
  })
  .optional();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `billing:${tenantSlug}:portal`,
    "admin.billing"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = bodySchema.parse(JSON.parse(text)) ?? {};
    }
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const billing = await getTenantBilling(authResult.tenant.id);
    if (!billing?.stripeCustomerId) {
      return Response.json(
        {
          error: "No Stripe customer for this workspace yet. Subscribe first.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const baseUrl = getAppBaseUrl().replace(/\/+$/, "");
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripeCustomerId,
      return_url: `${baseUrl}/admin/billing`,
      ...(body?.flow === "payment_method_update"
        ? {
            flow_data: {
              type: "payment_method_update" as const,
            },
          }
        : {}),
    });

    await insertSecurityAuditEvent({
      action: "tenant.billing.portal_opened",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: { flow: body?.flow ?? null, sessionId: session.id },
      resource: `billing:${tenantSlug}:portal`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not open billing portal.";
    return Response.json({ error: message }, { status: 400 });
  }
}
