import { getDefaultCardSummary } from "@/core/lib/billing/payment-method";
import { getStripe, SAAS_TAX_CODE } from "@/core/lib/billing/stripe";
import {
  ensureTenantBilling,
  isTenantSubscriptionActive,
} from "@/core/lib/db/billing-queries";
import { creditTenantTopUpFromCheckout } from "@/core/lib/db/topup-queries";
import {
  isValidTopUpUsd,
  MAX_TOP_UP_USD,
  MIN_TOP_UP_USD,
} from "@/shared/billing/topup-packs";

function assertTopUpAmount(amountUsd: number) {
  if (!isValidTopUpUsd(amountUsd)) {
    throw new Error(
      `Enter a whole dollar amount from $${MIN_TOP_UP_USD} to $${MAX_TOP_UP_USD.toLocaleString("en-US")}.`
    );
  }
}

async function loadTopUpContext(tenantId: string) {
  const billing = await ensureTenantBilling(tenantId);
  if (!(isTenantSubscriptionActive(billing) && billing.stripeCustomerId)) {
    throw new Error("Subscribe to a plan before buying a top-up.");
  }
  return billing;
}

/** Estimate charge for a top-up (does not charge). Credits = face-value dollars. */
export async function previewTopUp(args: {
  tenantId: string;
  amountUsd: number;
}) {
  assertTopUpAmount(args.amountUsd);
  const billing = await loadTopUpContext(args.tenantId);
  const amountCents = args.amountUsd * 100;
  const stripe = getStripe();

  const preview = await stripe.invoices.createPreview({
    automatic_tax: { enabled: true },
    customer: billing.stripeCustomerId as string,
    invoice_items: [
      {
        amount: amountCents,
        currency: "usd",
        description: `Kimiro AI top-up $${args.amountUsd}`,
        tax_code: SAAS_TAX_CODE,
      },
    ],
  });

  const subtotalCents = Math.max(
    0,
    preview.total_excluding_tax ?? preview.subtotal ?? amountCents
  );
  const amountDueCents = Math.max(0, preview.amount_due ?? amountCents);
  const taxCents = Math.max(0, amountDueCents - subtotalCents);

  const card = await getDefaultCardSummary({
    customerId: billing.stripeCustomerId as string,
    subscriptionId: billing.stripeSubscriptionId,
  });

  return {
    amountDueCents,
    amountUsd: args.amountUsd,
    amountUsdCents: amountCents,
    card,
    currency: (preview.currency || "usd").toUpperCase(),
    currentBalanceUsdCents: billing.topUpBalanceUsdCents,
    subtotalCents,
    taxCents,
  };
}

/**
 * Charge the card on file for a top-up and credit prepaid balance.
 * Call only after the admin explicitly confirms the preview.
 */
export async function confirmTopUp(args: {
  tenantId: string;
  amountUsd: number;
}) {
  assertTopUpAmount(args.amountUsd);
  const billing = await loadTopUpContext(args.tenantId);
  const amountCents = args.amountUsd * 100;
  const stripe = getStripe();
  const customerId = billing.stripeCustomerId as string;

  await stripe.invoiceItems.create({
    amount: amountCents,
    currency: "usd",
    customer: customerId,
    description: `Kimiro AI top-up $${args.amountUsd}`,
    tax_code: SAAS_TAX_CODE,
  });

  let invoice = await stripe.invoices.create({
    auto_advance: false,
    automatic_tax: { enabled: true },
    collection_method: "charge_automatically",
    customer: customerId,
    metadata: {
      amountUsdCents: String(amountCents),
      purpose: "topup",
      tenantId: args.tenantId,
    },
  });

  try {
    invoice = await stripe.invoices.finalizeInvoice(invoice.id);
    if (invoice.status !== "paid") {
      invoice = await stripe.invoices.pay(invoice.id);
    }
  } catch (error) {
    try {
      await stripe.invoices.voidInvoice(invoice.id);
    } catch {
      // best-effort cleanup
    }
    throw error instanceof Error ? error : new Error("Top-up payment failed.");
  }

  if (invoice.status !== "paid") {
    throw new Error("Top-up payment did not complete.");
  }

  const credited = await creditTenantTopUpFromCheckout({
    amountUsdCents: amountCents,
    stripeCheckoutSessionId: invoice.id,
    tenantId: args.tenantId,
  });

  return {
    amountPaidCents: Math.max(
      0,
      invoice.amount_paid ?? invoice.amount_due ?? 0
    ),
    amountUsd: args.amountUsd,
    amountUsdCents: amountCents,
    balanceUsdCents: credited.balanceUsdCents,
    currency: (invoice.currency || "usd").toUpperCase(),
    invoiceId: invoice.id,
  };
}
