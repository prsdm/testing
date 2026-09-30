/**
 * Stripe helpers for Kimiro per-seat billing + prepaid top-ups.
 *
 * Dashboard setup (one-time):
 * 1. Product "Kimiro Seat" — recurring prices:
 *    - Monthly: $25 / seat / month → STRIPE_PRICE_SEAT_MONTHLY
 *    - Yearly: $276 / seat / year ($23/mo effective) → STRIPE_PRICE_SEAT_YEARLY
 *    Set both prices to tax behavior **Exclusive** (tax added on top).
 * 2. Enable Stripe Tax: Dashboard → Tax → turn on. Optionally set default
 *    product tax code to SaaS (txcd_10103001).
 * 3. Top-ups use Checkout `mode=payment`. Extra seats confirm in-app and
 *    charge the card on file (prorated invoice).
 * 4. Webhook endpoint → /api/stripe/webhook
 *    events: checkout.session.completed, customer.subscription.*,
 *    invoice.paid, invoice.payment_failed
 */

import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2026-07-29.dahlia",
      typescript: true,
    });
  }
  return stripeClient;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getStripeWebhookSecret() {
  return requireEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripeSeatPriceId(interval: "month" | "year") {
  return interval === "year"
    ? requireEnv("STRIPE_PRICE_SEAT_YEARLY")
    : requireEnv("STRIPE_PRICE_SEAT_MONTHLY");
}

export function getStripeSeatPriceIds() {
  return {
    monthly: requireEnv("STRIPE_PRICE_SEAT_MONTHLY"),
    yearly: requireEnv("STRIPE_PRICE_SEAT_YEARLY"),
  };
}

export function getAppBaseUrl() {
  return (
    process.env.KIMIRO_APP_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    "http://localhost:5173"
  );
}

/**
 * Stripe Tax: tax/VAT calculated separately (exclusive) like Cursor.
 * Requires Tax enabled in Dashboard → Settings → Tax, and seat prices
 * set to tax behavior "Exclusive".
 */
export const CHECKOUT_TAX_OPTIONS = {
  automatic_tax: { enabled: true },
  billing_address_collection: "required" as const,
  customer_update: {
    address: "auto" as const,
    name: "auto" as const,
  },
  tax_id_collection: { enabled: true },
};

/** Stripe tax code: Software as a service (SaaS) — business use. */
export const SAAS_TAX_CODE = "txcd_10103001";

export type SubscriptionPeriod = {
  start: Date | null;
  end: Date | null;
  interval: "month" | "year" | null;
  seatItemId: string | null;
  seatQuantity: number;
};

export function parseSubscriptionPeriod(
  subscription: Stripe.Subscription,
  seatPriceIds: { monthly: string; yearly: string }
): SubscriptionPeriod {
  const items = subscription.items.data;
  let seatItem: Stripe.SubscriptionItem | undefined;

  for (const item of items) {
    const priceId = typeof item.price === "string" ? item.price : item.price.id;
    if (priceId === seatPriceIds.monthly || priceId === seatPriceIds.yearly) {
      seatItem = item;
    }
  }

  if (!seatItem) {
    seatItem = items.find(
      (item) => item.price.recurring?.usage_type !== "metered"
    );
  }

  const periodSource = seatItem ?? items.at(0);
  const periodStartUnix =
    (periodSource as { current_period_start?: number } | undefined)
      ?.current_period_start ??
    (subscription as { current_period_start?: number }).current_period_start;
  const periodEndUnix =
    (periodSource as { current_period_end?: number } | undefined)
      ?.current_period_end ??
    (subscription as { current_period_end?: number }).current_period_end;

  const priceInterval =
    seatItem?.price.recurring?.interval === "year"
      ? "year"
      : seatItem?.price.recurring?.interval === "month"
        ? "month"
        : null;

  return {
    end:
      typeof periodEndUnix === "number" ? new Date(periodEndUnix * 1000) : null,
    interval: priceInterval,
    seatItemId: seatItem?.id ?? null,
    seatQuantity: seatItem?.quantity ?? 0,
    start:
      typeof periodStartUnix === "number"
        ? new Date(periodStartUnix * 1000)
        : null,
  };
}
