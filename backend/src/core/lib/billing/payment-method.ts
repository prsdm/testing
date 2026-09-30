import { getStripe } from "./stripe";

export type CardSummary = { brand: string; last4: string };

/** Default card on the subscription, else the customer's default payment method. */
export async function getDefaultCardSummary(args: {
  customerId: string;
  subscriptionId?: string | null;
}): Promise<CardSummary | null> {
  const stripe = getStripe();
  let pmId: string | null = null;

  if (args.subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(
      args.subscriptionId
    );
    pmId =
      typeof subscription.default_payment_method === "string"
        ? subscription.default_payment_method
        : (subscription.default_payment_method?.id ?? null);
  }

  if (!pmId) {
    const customer = await stripe.customers.retrieve(args.customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (!("deleted" in customer && customer.deleted)) {
      const defaultPm = customer.invoice_settings?.default_payment_method;
      pmId =
        typeof defaultPm === "string" ? defaultPm : (defaultPm?.id ?? null);
    }
  }

  if (!pmId) {
    return null;
  }

  const paymentMethod = await stripe.paymentMethods.retrieve(pmId);
  const card = paymentMethod.card;
  if (!card?.last4) {
    return null;
  }
  return {
    brand: (card.brand || "card").toLowerCase(),
    last4: card.last4,
  };
}
