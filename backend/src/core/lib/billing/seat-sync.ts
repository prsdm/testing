import {
  ensureTenantBilling,
  isTenantSubscriptionActive,
  updateTenantBillingFields,
} from "@/core/lib/db/billing-queries";
import { countRawActiveTenantSeats } from "@/core/lib/db/usage-queries";
import { getDefaultCardSummary } from "./payment-method";
import { getStripe } from "./stripe";

function assertSeatIncreaseAllowed(args: {
  subscribed: boolean;
  currentPaidSeats: number;
  activeSeats: number;
  quantity: number;
}) {
  if (!args.subscribed) {
    throw new Error("Subscribe before buying additional seats.");
  }
  if (!Number.isFinite(args.quantity) || args.quantity < 1) {
    throw new Error("Seat quantity must be at least 1.");
  }
  if (args.quantity < args.activeSeats) {
    throw new Error(
      `Seat quantity cannot be below active members (${args.activeSeats}).`
    );
  }
  if (args.quantity <= args.currentPaidSeats) {
    throw new Error(
      `Already have ${args.currentPaidSeats} paid seats. Choose a higher quantity.`
    );
  }
}

async function loadSeatIncreaseContext(args: {
  tenantId: string;
  quantity: number;
}) {
  const billing = await ensureTenantBilling(args.tenantId);
  if (
    !(
      isTenantSubscriptionActive(billing) &&
      billing.stripeCustomerId &&
      billing.stripeSubscriptionId &&
      billing.stripeSubscriptionItemId
    )
  ) {
    throw new Error("Subscribe before buying additional seats.");
  }

  const quantity = Math.floor(args.quantity);
  const activeSeats = await countRawActiveTenantSeats(args.tenantId);
  assertSeatIncreaseAllowed({
    activeSeats,
    currentPaidSeats: billing.seatQuantity,
    quantity,
    subscribed: true,
  });

  return {
    addCount: quantity - billing.seatQuantity,
    billing,
    quantity,
  };
}

/** Estimate prorated charge for adding seats (does not charge). */
export async function previewSeatIncrease(args: {
  tenantId: string;
  quantity: number;
}) {
  const { billing, quantity, addCount } = await loadSeatIncreaseContext(args);
  const stripe = getStripe();

  const preview = await stripe.invoices.createPreview({
    automatic_tax: { enabled: true },
    customer: billing.stripeCustomerId as string,
    subscription: billing.stripeSubscriptionId as string,
    subscription_details: {
      items: [
        {
          id: billing.stripeSubscriptionItemId as string,
          quantity,
        },
      ],
      proration_behavior: "create_prorations",
    },
  });

  const subtotalCents = Math.max(
    0,
    preview.total_excluding_tax ?? preview.subtotal ?? 0
  );
  const amountDueCents = Math.max(0, preview.amount_due ?? 0);
  const taxCents = Math.max(0, amountDueCents - subtotalCents);

  const card = await getDefaultCardSummary({
    customerId: billing.stripeCustomerId as string,
    subscriptionId: billing.stripeSubscriptionId as string,
  });

  return {
    addCount,
    amountDueCents,
    card,
    currency: (preview.currency || "usd").toUpperCase(),
    currentSeatQuantity: billing.seatQuantity,
    quantity,
    subtotalCents,
    taxCents,
  };
}

/**
 * Confirm seat increase in-app: charge the card on file (prorated invoice).
 * Call only after the admin explicitly confirms the preview.
 */
export async function confirmSeatIncrease(args: {
  tenantId: string;
  quantity: number;
}) {
  const { billing, quantity, addCount } = await loadSeatIncreaseContext(args);
  const stripe = getStripe();

  const subscription = await stripe.subscriptions.update(
    billing.stripeSubscriptionId as string,
    {
      expand: ["latest_invoice"],
      items: [
        {
          id: billing.stripeSubscriptionItemId as string,
          quantity,
        },
      ],
      payment_behavior: "error_if_incomplete",
      proration_behavior: "always_invoice",
    }
  );

  await updateTenantBillingFields(args.tenantId, { seatQuantity: quantity });

  const latestInvoice = subscription.latest_invoice;
  const invoice =
    typeof latestInvoice === "string"
      ? await stripe.invoices.retrieve(latestInvoice)
      : latestInvoice;

  return {
    addCount,
    amountPaidCents: Math.max(
      0,
      invoice?.amount_paid ?? invoice?.amount_due ?? 0
    ),
    currency: (invoice?.currency || "usd").toUpperCase(),
    invoiceId: invoice?.id ?? null,
    quantity,
    seatQuantity: quantity,
    status: invoice?.status ?? null,
  };
}
