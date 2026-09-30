import { eq } from "drizzle-orm";
import { ChatbotError } from "@/shared/errors";
import { getDb } from "./client";
import { type TenantBilling, tenantBilling } from "./tables";

const db = getDb();

export async function getTenantBilling(
  tenantId: string
): Promise<TenantBilling | null> {
  const [row] = await db
    .select()
    .from(tenantBilling)
    .where(eq(tenantBilling.tenantId, tenantId))
    .limit(1);
  return row ?? null;
}

export async function ensureTenantBilling(
  tenantId: string
): Promise<TenantBilling> {
  const existing = await getTenantBilling(tenantId);
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(tenantBilling)
    .values({ tenantId })
    .onConflictDoNothing({ target: tenantBilling.tenantId })
    .returning();
  if (created) {
    return created;
  }
  const again = await getTenantBilling(tenantId);
  if (!again) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to ensure tenant billing"
    );
  }
  return again;
}

export async function getTenantBillingByStripeCustomerId(
  stripeCustomerId: string
): Promise<TenantBilling | null> {
  const [row] = await db
    .select()
    .from(tenantBilling)
    .where(eq(tenantBilling.stripeCustomerId, stripeCustomerId))
    .limit(1);
  return row ?? null;
}

export async function getTenantBillingByStripeSubscriptionId(
  stripeSubscriptionId: string
): Promise<TenantBilling | null> {
  const [row] = await db
    .select()
    .from(tenantBilling)
    .where(eq(tenantBilling.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return row ?? null;
}

export type UpsertTenantBillingFromStripeArgs = {
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeSubscriptionItemId: string | null;
  status: string;
  interval: "month" | "year" | null;
  seatQuantity: number;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
};

export async function upsertTenantBillingFromStripe(
  args: UpsertTenantBillingFromStripeArgs
): Promise<TenantBilling> {
  const now = new Date();
  const [row] = await db
    .insert(tenantBilling)
    .values({
      currentPeriodEnd: args.currentPeriodEnd,
      currentPeriodStart: args.currentPeriodStart,
      interval: args.interval,
      seatQuantity: args.seatQuantity,
      status: args.status,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeSubscriptionItemId: args.stripeSubscriptionItemId,
      tenantId: args.tenantId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      set: {
        currentPeriodEnd: args.currentPeriodEnd,
        currentPeriodStart: args.currentPeriodStart,
        interval: args.interval,
        seatQuantity: args.seatQuantity,
        status: args.status,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeSubscriptionItemId: args.stripeSubscriptionItemId,
        updatedAt: now,
      },
      target: tenantBilling.tenantId,
    })
    .returning();

  if (!row) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to upsert tenant billing"
    );
  }
  return row;
}

export async function updateTenantBillingFields(
  tenantId: string,
  fields: Partial<{
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripeSubscriptionItemId: string | null;
    status: string;
    interval: string | null;
    seatQuantity: number;
    topUpBalanceUsdCents: number;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  }>
): Promise<TenantBilling> {
  await ensureTenantBilling(tenantId);
  const [row] = await db
    .update(tenantBilling)
    .set({ ...fields, updatedAt: new Date() })
    .where(eq(tenantBilling.tenantId, tenantId))
    .returning();
  if (!row) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to update tenant billing"
    );
  }
  return row;
}

export function isTenantSubscriptionActive(
  billing: TenantBilling | null | undefined
) {
  if (!billing) {
    return false;
  }
  return (
    billing.status === "active" ||
    billing.status === "trialing" ||
    billing.status === "past_due"
  );
}
