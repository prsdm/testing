import { and, desc, eq, gte, sql } from "drizzle-orm";
import { centsToMicros, microsToUsd } from "@/core/lib/billing/usage-cost";
import { ensureTenantBilling } from "./billing-queries";
import { getDb } from "./client";
import { tenantBilling, tenantTopUpLedger } from "./tables";
import { getTenantUsageGateSnapshot } from "./usage-queries";

const db = getDb();

export async function creditTenantTopUpFromCheckout(args: {
  tenantId: string;
  amountUsdCents: number;
  stripeCheckoutSessionId: string;
}): Promise<{ credited: boolean; balanceUsdCents: number }> {
  const amount = Math.max(0, Math.round(args.amountUsdCents));
  if (amount <= 0) {
    return { balanceUsdCents: 0, credited: false };
  }

  await ensureTenantBilling(args.tenantId);

  return await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: tenantTopUpLedger.id })
      .from(tenantTopUpLedger)
      .where(
        eq(
          tenantTopUpLedger.stripeCheckoutSessionId,
          args.stripeCheckoutSessionId
        )
      )
      .limit(1);
    if (existing) {
      const [billing] = await tx
        .select({ balance: tenantBilling.topUpBalanceUsdCents })
        .from(tenantBilling)
        .where(eq(tenantBilling.tenantId, args.tenantId))
        .limit(1);
      return {
        balanceUsdCents: Number(billing?.balance ?? 0),
        credited: false,
      };
    }

    const [updated] = await tx
      .update(tenantBilling)
      .set({
        topUpBalanceUsdCents: sql`${tenantBilling.topUpBalanceUsdCents} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(tenantBilling.tenantId, args.tenantId))
      .returning({ balance: tenantBilling.topUpBalanceUsdCents });

    const balanceAfter = Number(updated?.balance ?? amount);
    await tx.insert(tenantTopUpLedger).values({
      amountUsdCents: amount,
      balanceAfterUsdCents: balanceAfter,
      kind: "purchase",
      note: `Top-up $${(amount / 100).toFixed(0)}`,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      tenantId: args.tenantId,
    });

    return { balanceUsdCents: balanceAfter, credited: true };
  });
}

/**
 * Debit prepaid balance for usage that exceeded the included workspace pool.
 * Idempotent per usageEventId when provided.
 */
export async function debitTopUpForOverageEvent(args: {
  tenantId: string;
  eventCostUsdMicros: number;
  usageEventId?: string | null;
}): Promise<{ debitedUsdCents: number; balanceUsdCents: number }> {
  if (args.eventCostUsdMicros <= 0) {
    const billing = await ensureTenantBilling(args.tenantId);
    return {
      balanceUsdCents: billing.topUpBalanceUsdCents,
      debitedUsdCents: 0,
    };
  }

  const snap = await getTenantUsageGateSnapshot({ tenantId: args.tenantId });
  const poolMicros = centsToMicros(snap.allowanceUsdCents);
  const usedAfter = snap.workspaceUsedUsdMicros;
  const usedBefore = Math.max(0, usedAfter - args.eventCostUsdMicros);
  const overageMicros =
    Math.max(0, usedAfter - poolMicros) - Math.max(0, usedBefore - poolMicros);
  const overageCents = Math.ceil(overageMicros / 10_000);
  if (overageCents <= 0) {
    return {
      balanceUsdCents: snap.billing?.topUpBalanceUsdCents ?? 0,
      debitedUsdCents: 0,
    };
  }

  await ensureTenantBilling(args.tenantId);

  return await db.transaction(async (tx) => {
    if (args.usageEventId) {
      const [existing] = await tx
        .select({ id: tenantTopUpLedger.id })
        .from(tenantTopUpLedger)
        .where(eq(tenantTopUpLedger.usageEventId, args.usageEventId))
        .limit(1);
      if (existing) {
        const [billing] = await tx
          .select({ balance: tenantBilling.topUpBalanceUsdCents })
          .from(tenantBilling)
          .where(eq(tenantBilling.tenantId, args.tenantId))
          .limit(1);
        return {
          balanceUsdCents: Number(billing?.balance ?? 0),
          debitedUsdCents: 0,
        };
      }
    }

    const [current] = await tx
      .select({ balance: tenantBilling.topUpBalanceUsdCents })
      .from(tenantBilling)
      .where(eq(tenantBilling.tenantId, args.tenantId))
      .limit(1);
    const available = Math.max(0, Number(current?.balance ?? 0));
    const debit = Math.min(available, overageCents);
    if (debit <= 0) {
      return { balanceUsdCents: available, debitedUsdCents: 0 };
    }

    const [updated] = await tx
      .update(tenantBilling)
      .set({
        topUpBalanceUsdCents: sql`GREATEST(0, ${tenantBilling.topUpBalanceUsdCents} - ${debit})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tenantBilling.tenantId, args.tenantId),
          gte(tenantBilling.topUpBalanceUsdCents, debit)
        )
      )
      .returning({ balance: tenantBilling.topUpBalanceUsdCents });

    if (!updated) {
      const [again] = await tx
        .select({ balance: tenantBilling.topUpBalanceUsdCents })
        .from(tenantBilling)
        .where(eq(tenantBilling.tenantId, args.tenantId))
        .limit(1);
      return {
        balanceUsdCents: Number(again?.balance ?? 0),
        debitedUsdCents: 0,
      };
    }

    await tx.insert(tenantTopUpLedger).values({
      amountUsdCents: -debit,
      balanceAfterUsdCents: Number(updated.balance),
      kind: "debit",
      note: "Overage beyond included pool",
      tenantId: args.tenantId,
      usageEventId: args.usageEventId ?? null,
    });

    return {
      balanceUsdCents: Number(updated.balance),
      debitedUsdCents: debit,
    };
  });
}

export async function listRecentTenantTopUps(tenantId: string, limit = 10) {
  return await db
    .select({
      amountUsdCents: tenantTopUpLedger.amountUsdCents,
      balanceAfterUsdCents: tenantTopUpLedger.balanceAfterUsdCents,
      createdAt: tenantTopUpLedger.createdAt,
      id: tenantTopUpLedger.id,
      kind: tenantTopUpLedger.kind,
      note: tenantTopUpLedger.note,
    })
    .from(tenantTopUpLedger)
    .where(eq(tenantTopUpLedger.tenantId, tenantId))
    .orderBy(desc(tenantTopUpLedger.createdAt))
    .limit(limit);
}

export function topUpBalanceUsd(cents: number) {
  return microsToUsd(centsToMicros(cents));
}
