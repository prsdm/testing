import type Stripe from "stripe";
import {
  updateTenantBillingFields,
  upsertTenantBillingFromStripe,
} from "@/core/lib/db/billing-queries";
import { getStripeSeatPriceIds, parseSubscriptionPeriod } from "./stripe";

export async function applyStripeSubscriptionToTenant(args: {
  tenantId: string;
  subscription: Stripe.Subscription;
  stripeCustomerId: string;
}) {
  const seatPriceIds = getStripeSeatPriceIds();
  const parsed = parseSubscriptionPeriod(args.subscription, seatPriceIds);

  await upsertTenantBillingFromStripe({
    currentPeriodEnd: parsed.end,
    currentPeriodStart: parsed.start,
    interval: parsed.interval,
    seatQuantity: parsed.seatQuantity,
    status: args.subscription.status,
    stripeCustomerId: args.stripeCustomerId,
    stripeSubscriptionId: args.subscription.id,
    stripeSubscriptionItemId: parsed.seatItemId,
    tenantId: args.tenantId,
  });
}

export async function clearStripeSubscription(tenantId: string) {
  await updateTenantBillingFields(tenantId, {
    currentPeriodEnd: null,
    currentPeriodStart: null,
    interval: null,
    seatQuantity: 0,
    status: "canceled",
    stripeSubscriptionId: null,
    stripeSubscriptionItemId: null,
  });
}

export function customerIdFromStripe(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) {
    return null;
  }
  if (typeof customer === "string") {
    return customer;
  }
  if ("deleted" in customer && customer.deleted) {
    return null;
  }
  return customer.id;
}
