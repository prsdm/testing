import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  CHECKOUT_TAX_OPTIONS,
  getAppBaseUrl,
  getStripe,
  getStripeSeatPriceId,
} from "@/core/lib/billing/stripe";
import {
  ensureTenantBilling,
  isTenantSubscriptionActive,
  updateTenantBillingFields,
} from "@/core/lib/db/billing-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";
import { countActiveTenantSeats } from "@/core/lib/db/usage-queries";

const bodySchema = z.object({
  interval: z.enum(["month", "year"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `billing:${tenantSlug}:checkout`,
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
    const billing = await ensureTenantBilling(authResult.tenant.id);
    if (isTenantSubscriptionActive(billing) && billing.stripeSubscriptionId) {
      return Response.json(
        {
          error:
            "This workspace already has an active subscription. Use Manage billing instead.",
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const seatCount = await countActiveTenantSeats(authResult.tenant.id);
    const priceId = getStripeSeatPriceId(body.interval);
    const baseUrl = getAppBaseUrl().replace(/\/+$/, "");
    const successUrl = `${baseUrl}/admin/billing?checkout=success`;
    const cancelUrl = `${baseUrl}/admin/billing?checkout=cancel`;

    let customerId = billing.stripeCustomerId;
    if (customerId) {
      try {
        const existing = await stripe.customers.retrieve(customerId);
        if ("deleted" in existing && existing.deleted) {
          customerId = null;
        }
      } catch {
        customerId = null;
      }
      if (!customerId) {
        await updateTenantBillingFields(authResult.tenant.id, {
          status: "none",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripeSubscriptionItemId: null,
        });
      }
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: authResult.userEmail,
        metadata: {
          tenantId: authResult.tenant.id,
          tenantSlug,
        },
        name: authResult.tenant.companyName,
      });
      customerId = customer.id;
      await updateTenantBillingFields(authResult.tenant.id, {
        stripeCustomerId: customerId,
      });
    }

    const session = await stripe.checkout.sessions.create({
      allow_promotion_codes: true,
      client_reference_id: authResult.tenant.id,
      customer: customerId,
      mode: "subscription",
      ...CHECKOUT_TAX_OPTIONS,
      cancel_url: cancelUrl,
      line_items: [
        {
          price: priceId,
          quantity: seatCount,
        },
      ],
      metadata: {
        interval: body.interval,
        tenantId: authResult.tenant.id,
        tenantSlug,
      },
      subscription_data: {
        metadata: {
          tenantId: authResult.tenant.id,
          tenantSlug,
        },
      },
      success_url: successUrl,
    });

    await insertSecurityAuditEvent({
      action: "tenant.billing.checkout_started",
      email: authResult.userEmail,
      ipAddress: authResult.ipAddress,
      metadata: {
        interval: body.interval,
        seatCount,
        sessionId: session.id,
      },
      resource: `billing:${tenantSlug}:checkout`,
      tenantId: authResult.tenant.id,
      userAgent: request.headers.get("user-agent"),
      userId: authResult.userId,
    });

    if (!session.url) {
      return Response.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    return Response.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start checkout.";
    return Response.json({ error: message }, { status: 400 });
  }
}
