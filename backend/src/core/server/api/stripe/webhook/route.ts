import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  applyStripeSubscriptionToTenant,
  clearStripeSubscription,
  customerIdFromStripe,
} from "@/core/lib/billing/apply-stripe-subscription";
import { getStripe, getStripeWebhookSecret } from "@/core/lib/billing/stripe";
import {
  getTenantBillingByStripeCustomerId,
  getTenantBillingByStripeSubscriptionId,
  updateTenantBillingFields,
} from "@/core/lib/db/billing-queries";
import { getDb } from "@/core/lib/db/client";
import { tenants } from "@/core/lib/db/tables";

async function resolveTenantIdFromSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = subscription.metadata?.tenantId?.trim();
  if (fromMeta) {
    return fromMeta;
  }

  const bySub = await getTenantBillingByStripeSubscriptionId(subscription.id);
  if (bySub) {
    return bySub.tenantId;
  }

  const customerId = customerIdFromStripe(subscription.customer);
  if (customerId) {
    const byCustomer = await getTenantBillingByStripeCustomerId(customerId);
    if (byCustomer) {
      return byCustomer.tenantId;
    }
  }
  return null;
}

async function tenantExists(tenantId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  return Boolean(row);
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret()
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature";
    return Response.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId =
          session.metadata?.tenantId?.trim() ||
          session.client_reference_id?.trim();

        if (
          session.mode === "payment" &&
          session.metadata?.purpose === "topup"
        ) {
          if (!(tenantId && (await tenantExists(tenantId)))) {
            break;
          }
          const amountFromMeta = Number.parseInt(
            session.metadata.amountUsdCents ?? "",
            10
          );
          const amountUsdCents = Number.isFinite(amountFromMeta)
            ? amountFromMeta
            : (session.amount_total ?? 0);
          const { creditTenantTopUpFromCheckout } = await import(
            "@/core/lib/db/topup-queries"
          );
          await creditTenantTopUpFromCheckout({
            amountUsdCents,
            stripeCheckoutSessionId: session.id,
            tenantId,
          });
          break;
        }

        if (session.mode !== "subscription") {
          break;
        }
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        const customerId = customerIdFromStripe(session.customer);
        if (!(tenantId && subscriptionId && customerId)) {
          break;
        }
        if (!(await tenantExists(tenantId))) {
          break;
        }
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        await applyStripeSubscriptionToTenant({
          stripeCustomerId: customerId,
          subscription,
          tenantId,
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = await resolveTenantIdFromSubscription(subscription);
        const customerId = customerIdFromStripe(subscription.customer);
        if (!(tenantId && customerId)) {
          break;
        }
        if (subscription.status === "canceled") {
          await clearStripeSubscription(tenantId);
          break;
        }
        await applyStripeSubscriptionToTenant({
          stripeCustomerId: customerId,
          subscription,
          tenantId,
        });
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = await resolveTenantIdFromSubscription(subscription);
        if (tenantId) {
          await clearStripeSubscription(tenantId);
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
          parent?: {
            subscription_details?: { subscription?: string | null } | null;
          } | null;
        };
        const subscriptionId =
          (typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id) ||
          invoice.parent?.subscription_details?.subscription ||
          null;
        if (!subscriptionId) {
          break;
        }
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        const tenantId = await resolveTenantIdFromSubscription(subscription);
        const customerId = customerIdFromStripe(subscription.customer);
        if (!(tenantId && customerId)) {
          break;
        }
        await applyStripeSubscriptionToTenant({
          stripeCustomerId: customerId,
          subscription,
          tenantId,
        });
        if (event.type === "invoice.payment_failed") {
          await updateTenantBillingFields(tenantId, {
            status: subscription.status || "past_due",
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe.webhook] handler failed", {
      error: error instanceof Error ? error.message : error,
      type: event.type,
    });
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
