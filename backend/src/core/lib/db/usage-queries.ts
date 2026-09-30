import { and, asc, eq, gt, gte, isNull, lt, sql, sum } from "drizzle-orm";
import { resolveBillableSeatCount } from "@/core/lib/billing/seat-capacity";
import type {
  CacheWriteTtl,
  PricingServiceTier,
} from "@/core/lib/billing/usage-cost";
import {
  centsToMicros,
  DEFAULT_PER_SEAT_ALLOWANCE_USD_CENTS,
  estimateUsageCostUsdMicros,
  microsToUsd,
  usagePercentUsed,
} from "@/core/lib/billing/usage-cost";
import { ChatbotError } from "@/shared/errors";
import {
  getTenantBilling,
  isTenantSubscriptionActive,
} from "./billing-queries";
import { getDb } from "./client";
import {
  authUser,
  tenantInvites,
  tenantMembers,
  tenantMemberUsageQuotas,
  tenants,
  tenantUsageEvents,
  tenantUsageSettings,
} from "./tables";

const db = getDb();

export type UsageSource = "chat" | "artifact";

function startOfUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextUtcMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

/** Prefer Stripe subscription period when subscribed; else calendar UTC month. */
export async function resolveTenantUsagePeriod(tenantId: string): Promise<{
  periodStart: Date;
  periodEnd: Date;
}> {
  const billing = await getTenantBilling(tenantId);
  if (
    isTenantSubscriptionActive(billing) &&
    billing?.currentPeriodStart &&
    billing.currentPeriodEnd
  ) {
    return {
      periodEnd: billing.currentPeriodEnd,
      periodStart: billing.currentPeriodStart,
    };
  }
  return {
    periodEnd: startOfNextUtcMonth(),
    periodStart: startOfUtcMonth(),
  };
}

export async function ensureTenantUsageSettings(tenantId: string) {
  const [existing] = await db
    .select()
    .from(tenantUsageSettings)
    .where(eq(tenantUsageSettings.tenantId, tenantId))
    .limit(1);
  if (existing) {
    return existing;
  }
  const [created] = await db
    .insert(tenantUsageSettings)
    .values({
      monthlyAllowanceUsdCents: DEFAULT_PER_SEAT_ALLOWANCE_USD_CENTS,
      tenantId,
    })
    .onConflictDoNothing({ target: tenantUsageSettings.tenantId })
    .returning();
  if (created) {
    return created;
  }
  const [again] = await db
    .select()
    .from(tenantUsageSettings)
    .where(eq(tenantUsageSettings.tenantId, tenantId))
    .limit(1);
  if (!again) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to ensure usage settings"
    );
  }
  return again;
}

/** Active members count as billable seats (floor 1 for checkout / display). */
export async function countActiveTenantSeats(tenantId: string) {
  return Math.max(1, await countRawActiveTenantSeats(tenantId));
}

/** Raw active member count — no floor (for capacity checks). */
export async function countRawActiveTenantSeats(tenantId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, tenantId),
        eq(tenantMembers.isActive, true)
      )
    );
  return Math.max(0, Number(row?.count ?? 0));
}

/** Open invites that will consume a seat when accepted. */
export async function countPendingTenantInvites(tenantId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantInvites)
    .where(
      and(
        eq(tenantInvites.tenantId, tenantId),
        isNull(tenantInvites.acceptedAt),
        isNull(tenantInvites.revokedAt),
        gt(tenantInvites.expiresAt, new Date())
      )
    );
  return Math.max(0, Number(row?.count ?? 0));
}

/**
 * Founder = Tenant.ownerAuthUserId when set, else earliest TenantMember.
 * Only the founder gets the unpaid free-query trial.
 */
export async function isTenantFounder(args: {
  tenantId: string;
  authUserId: string;
}) {
  const [tenant] = await db
    .select({ ownerAuthUserId: tenants.ownerAuthUserId })
    .from(tenants)
    .where(eq(tenants.id, args.tenantId))
    .limit(1);
  if (tenant?.ownerAuthUserId) {
    return tenant.ownerAuthUserId === args.authUserId;
  }

  const [earliest] = await db
    .select({ authUserId: tenantMembers.authUserId })
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, args.tenantId))
    .orderBy(asc(tenantMembers.createdAt))
    .limit(1);
  return Boolean(earliest?.authUserId === args.authUserId);
}

/** Lifetime AI turns recorded for this member (free-trial query meter). */
export async function countTenantUsageEventsForUser(args: {
  tenantId: string;
  authUserId: string;
}) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tenantUsageEvents)
    .where(
      and(
        eq(tenantUsageEvents.tenantId, args.tenantId),
        eq(tenantUsageEvents.authUserId, args.authUserId)
      )
    );
  return Math.max(0, Number(row?.count ?? 0));
}

export async function recordTenantUsageEvent(args: {
  tenantId: string;
  authUserId?: string | null;
  chatId?: string | null;
  source?: UsageSource;
  modelId?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  webSearchCount?: number;
  imageGenerationCount?: number;
  imageGenerations?: ReadonlyArray<{ size?: string | null | undefined }>;
  sandboxExecCount?: number;
  sandboxExecDurationMs?: number;
  noCacheTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cacheWriteTtl?: CacheWriteTtl;
  serviceTier?: PricingServiceTier;
}) {
  const inputTokens = Math.max(0, args.inputTokens ?? 0);
  const outputTokens = Math.max(0, args.outputTokens ?? 0);
  const totalTokens = args.totalTokens ?? inputTokens + outputTokens;
  const webSearchCount = Math.max(0, args.webSearchCount ?? 0);
  const imageGenerations = args.imageGenerations ?? [];
  const imageGenerationCount = Math.max(
    0,
    args.imageGenerationCount ?? imageGenerations.length
  );
  const sandboxExecCount = Math.max(0, args.sandboxExecCount ?? 0);
  const sandboxExecDurationMs = Math.max(0, args.sandboxExecDurationMs ?? 0);
  const cacheReadTokens = Math.max(0, args.cacheReadTokens ?? 0);
  const cacheWriteTokens = Math.max(0, args.cacheWriteTokens ?? 0);
  const noCacheTokens =
    args.noCacheTokens == null
      ? Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)
      : Math.max(0, args.noCacheTokens);
  const estimatedCostUsdMicros = estimateUsageCostUsdMicros({
    cacheReadTokens,
    cacheWriteTokens,
    cacheWriteTtl: args.cacheWriteTtl,
    imageGenerations,
    inputTokens,
    modelId: args.modelId,
    noCacheTokens,
    outputTokens,
    serviceTier: args.serviceTier,
    webSearchCount,
  });

  if (
    inputTokens === 0 &&
    outputTokens === 0 &&
    webSearchCount === 0 &&
    imageGenerationCount === 0 &&
    sandboxExecCount === 0 &&
    estimatedCostUsdMicros === 0
  ) {
    return null;
  }

  try {
    const [row] = await db
      .insert(tenantUsageEvents)
      .values({
        authUserId: args.authUserId ?? null,
        chatId: args.chatId ?? null,
        estimatedCostUsdMicros,
        imageGenerationCount,
        inputTokens,
        modelId: args.modelId ?? null,
        outputTokens,
        sandboxExecCount,
        sandboxExecDurationMs,
        source: args.source ?? "chat",
        tenantId: args.tenantId,
        totalTokens,
        webSearchCount,
      })
      .returning();
    return row ?? null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to record usage"
    );
  }
}

/** Replace token/cost totals when a paused chat run resumes on the same turn. */
export async function updateTenantUsageEvent(args: {
  id: string;
  tenantId: string;
  modelId?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  webSearchCount?: number;
  imageGenerationCount?: number;
  imageGenerations?: ReadonlyArray<{ size?: string | null | undefined }>;
  sandboxExecCount?: number;
  sandboxExecDurationMs?: number;
  noCacheTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cacheWriteTtl?: CacheWriteTtl;
  serviceTier?: PricingServiceTier;
}) {
  const inputTokens = Math.max(0, args.inputTokens ?? 0);
  const outputTokens = Math.max(0, args.outputTokens ?? 0);
  const totalTokens = args.totalTokens ?? inputTokens + outputTokens;
  const webSearchCount = Math.max(0, args.webSearchCount ?? 0);
  const imageGenerations = args.imageGenerations ?? [];
  const imageGenerationCount = Math.max(
    0,
    args.imageGenerationCount ?? imageGenerations.length
  );
  const sandboxExecCount = Math.max(0, args.sandboxExecCount ?? 0);
  const sandboxExecDurationMs = Math.max(0, args.sandboxExecDurationMs ?? 0);
  const cacheReadTokens = Math.max(0, args.cacheReadTokens ?? 0);
  const cacheWriteTokens = Math.max(0, args.cacheWriteTokens ?? 0);
  const noCacheTokens =
    args.noCacheTokens == null
      ? Math.max(0, inputTokens - cacheReadTokens - cacheWriteTokens)
      : Math.max(0, args.noCacheTokens);
  const estimatedCostUsdMicros = estimateUsageCostUsdMicros({
    cacheReadTokens,
    cacheWriteTokens,
    cacheWriteTtl: args.cacheWriteTtl,
    imageGenerations,
    inputTokens,
    modelId: args.modelId,
    noCacheTokens,
    outputTokens,
    serviceTier: args.serviceTier,
    webSearchCount,
  });

  const [existing] = await db
    .select()
    .from(tenantUsageEvents)
    .where(
      and(
        eq(tenantUsageEvents.id, args.id),
        eq(tenantUsageEvents.tenantId, args.tenantId)
      )
    )
    .limit(1);
  if (!existing) {
    return null;
  }

  const previousCostMicros = existing.estimatedCostUsdMicros;

  try {
    const [row] = await db
      .update(tenantUsageEvents)
      .set({
        estimatedCostUsdMicros,
        imageGenerationCount,
        inputTokens,
        modelId: args.modelId ?? existing.modelId,
        outputTokens,
        sandboxExecCount,
        sandboxExecDurationMs,
        totalTokens,
        webSearchCount,
      })
      .where(eq(tenantUsageEvents.id, args.id))
      .returning();
    return row
      ? {
          costDeltaMicros: estimatedCostUsdMicros - previousCostMicros,
          previousCostMicros,
          row,
        }
      : null;
  } catch (error) {
    throw new ChatbotError(
      "bad_request:database",
      error instanceof Error ? error.message : "Failed to update usage"
    );
  }
}

export async function getTenantUsageEventById(args: {
  id: string;
  tenantId: string;
}) {
  const [event] = await db
    .select()
    .from(tenantUsageEvents)
    .where(
      and(
        eq(tenantUsageEvents.id, args.id),
        eq(tenantUsageEvents.tenantId, args.tenantId)
      )
    )
    .limit(1);
  return event;
}

export type MemberUsageMonthRow = {
  authUserId: string;
  email: string;
  displayName: string | null;
  usedUsdMicros: number;
  usedUsd: number;
  quotaUsdCents: number;
  isCustomQuota: boolean;
  percentUsed: number;
  softWarn: boolean;
  atLimit: boolean;
};

export type TenantUsageMonthSummary = {
  periodStart: string;
  periodEnd: string;
  /** Workspace pool = seats × per-seat allowance. */
  allowanceUsdCents: number;
  perSeatAllowanceUsdCents: number;
  seatCount: number;
  /** Sum of members’ effective personal quotas (must be ≤ pool). */
  allocatedQuotaUsdCents: number;
  usedUsdMicros: number;
  usedUsd: number;
  /** Estimated spend past the included pool this period. */
  overageUsdMicros: number;
  overageUsd: number;
  topUpBalanceUsdCents: number;
  topUpBalanceUsd: number;
  percentUsed: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  webSearchCount: number;
  imageGenerationCount: number;
  sandboxExecCount: number;
  sandboxExecDurationMs: number;
  eventCount: number;
  softWarn: boolean;
  atLimit: boolean;
  members: MemberUsageMonthRow[];
};

export async function getTenantUsageMonthSummary(
  tenantId: string
): Promise<TenantUsageMonthSummary> {
  const settings = await ensureTenantUsageSettings(tenantId);
  const billing = await getTenantBilling(tenantId);
  const perSeatAllowanceUsdCents = settings.monthlyAllowanceUsdCents;
  const activeSeatCount = await countActiveTenantSeats(tenantId);
  const seatCount = resolveBillableSeatCount({
    activeSeatCount,
    paidSeatQuantity: billing?.seatQuantity ?? 0,
    subscribed: isTenantSubscriptionActive(billing),
  });
  const allowanceUsdCents = seatCount * perSeatAllowanceUsdCents;
  const { periodStart, periodEnd } = await resolveTenantUsagePeriod(tenantId);

  const [agg] = await db
    .select({
      eventCount: sql<number>`count(*)::int`,
      imageGenerationCount: sum(tenantUsageEvents.imageGenerationCount),
      inputTokens: sum(tenantUsageEvents.inputTokens),
      outputTokens: sum(tenantUsageEvents.outputTokens),
      sandboxExecCount: sum(tenantUsageEvents.sandboxExecCount),
      sandboxExecDurationMs: sum(tenantUsageEvents.sandboxExecDurationMs),
      totalTokens: sum(tenantUsageEvents.totalTokens),
      usedUsdMicros: sum(tenantUsageEvents.estimatedCostUsdMicros),
      webSearchCount: sum(tenantUsageEvents.webSearchCount),
    })
    .from(tenantUsageEvents)
    .where(
      and(
        eq(tenantUsageEvents.tenantId, tenantId),
        gte(tenantUsageEvents.createdAt, periodStart),
        lt(tenantUsageEvents.createdAt, periodEnd)
      )
    );

  const usedUsdMicros = Number(agg?.usedUsdMicros ?? 0);
  const percentUsed = usagePercentUsed({
    allowanceUsdCents,
    usedUsdMicros,
  });
  const poolMicros = centsToMicros(allowanceUsdCents);
  const overageUsdMicros = Math.max(0, usedUsdMicros - poolMicros);
  const topUpBalanceUsdCents = billing?.topUpBalanceUsdCents ?? 0;

  const members = await listTenantMemberUsageMonth({
    periodEnd,
    periodStart,
    perSeatAllowanceUsdCents,
    tenantId,
  });

  const allocatedQuotaUsdCents = members.reduce(
    (sum, member) => sum + member.quotaUsdCents,
    0
  );

  return {
    allocatedQuotaUsdCents,
    allowanceUsdCents,
    atLimit: percentUsed >= 100,
    eventCount: Number(agg?.eventCount ?? 0),
    imageGenerationCount: Number(agg?.imageGenerationCount ?? 0),
    inputTokens: Number(agg?.inputTokens ?? 0),
    members,
    outputTokens: Number(agg?.outputTokens ?? 0),
    overageUsd: microsToUsd(overageUsdMicros),
    overageUsdMicros,
    percentUsed,
    periodEnd: periodEnd.toISOString(),
    periodStart: periodStart.toISOString(),
    perSeatAllowanceUsdCents,
    sandboxExecCount: Number(agg?.sandboxExecCount ?? 0),
    sandboxExecDurationMs: Number(agg?.sandboxExecDurationMs ?? 0),
    seatCount,
    softWarn: percentUsed >= 80,
    topUpBalanceUsd: microsToUsd(centsToMicros(topUpBalanceUsdCents)),
    topUpBalanceUsdCents,
    totalTokens: Number(agg?.totalTokens ?? 0),
    usedUsd: microsToUsd(usedUsdMicros),
    usedUsdMicros,
    webSearchCount: Number(agg?.webSearchCount ?? 0),
  };
}

async function listTenantMemberUsageMonth(args: {
  tenantId: string;
  perSeatAllowanceUsdCents: number;
  periodStart: Date;
  periodEnd: Date;
}): Promise<MemberUsageMonthRow[]> {
  const memberRows = await db
    .select({
      authUserId: tenantMembers.authUserId,
      email: tenantMembers.email,
      quotaUsdCents: tenantMemberUsageQuotas.monthlyQuotaUsdCents,
      usedUsdMicros: sum(tenantUsageEvents.estimatedCostUsdMicros),
      userName: authUser.name,
    })
    .from(tenantMembers)
    .innerJoin(authUser, eq(authUser.id, tenantMembers.authUserId))
    .leftJoin(
      tenantMemberUsageQuotas,
      and(
        eq(tenantMemberUsageQuotas.tenantId, tenantMembers.tenantId),
        eq(tenantMemberUsageQuotas.authUserId, tenantMembers.authUserId)
      )
    )
    .leftJoin(
      tenantUsageEvents,
      and(
        eq(tenantUsageEvents.tenantId, tenantMembers.tenantId),
        eq(tenantUsageEvents.authUserId, tenantMembers.authUserId),
        gte(tenantUsageEvents.createdAt, args.periodStart),
        lt(tenantUsageEvents.createdAt, args.periodEnd)
      )
    )
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.isActive, true)
      )
    )
    .groupBy(
      tenantMembers.authUserId,
      tenantMembers.email,
      authUser.name,
      tenantMemberUsageQuotas.monthlyQuotaUsdCents
    );

  return memberRows
    .map((row) => {
      const isCustomQuota = row.quotaUsdCents != null;
      const quotaUsdCents = row.quotaUsdCents ?? args.perSeatAllowanceUsdCents;
      const used = Number(row.usedUsdMicros ?? 0);
      const percentUsed = usagePercentUsed({
        allowanceUsdCents: quotaUsdCents,
        usedUsdMicros: used,
      });
      return {
        atLimit: percentUsed >= 100,
        authUserId: row.authUserId,
        displayName: row.userName?.trim() || null,
        email: row.email,
        isCustomQuota,
        percentUsed,
        quotaUsdCents,
        softWarn: percentUsed >= 80,
        usedUsd: microsToUsd(used),
        usedUsdMicros: used,
      };
    })
    .sort(
      (a, b) =>
        b.usedUsdMicros - a.usedUsdMicros || a.email.localeCompare(b.email)
    );
}

/**
 * Set or clear a member's monthly quota override.
 * Pass `null` to reset to the per-seat default.
 * Sum of personal quotas cannot exceed the workspace pool (seats × per-seat).
 */
export async function setTenantMemberUsageQuota(args: {
  tenantId: string;
  authUserId: string;
  monthlyQuotaUsdCents: number | null;
}) {
  const [member] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.authUserId),
        eq(tenantMembers.isActive, true)
      )
    )
    .limit(1);
  if (!member) {
    throw new Error("Member not found");
  }

  const settings = await ensureTenantUsageSettings(args.tenantId);
  const perSeat = settings.monthlyAllowanceUsdCents;
  const billing = await getTenantBilling(args.tenantId);
  const activeSeatCount = await countActiveTenantSeats(args.tenantId);
  const seatCount = resolveBillableSeatCount({
    activeSeatCount,
    paidSeatQuantity: billing?.seatQuantity ?? 0,
    subscribed: isTenantSubscriptionActive(billing),
  });
  const poolCents = seatCount * perSeat;
  const nextCents =
    args.monthlyQuotaUsdCents == null
      ? null
      : Math.max(0, Math.round(args.monthlyQuotaUsdCents));

  const activeMembers = await db
    .select({
      authUserId: tenantMembers.authUserId,
      overrideCents: tenantMemberUsageQuotas.monthlyQuotaUsdCents,
    })
    .from(tenantMembers)
    .leftJoin(
      tenantMemberUsageQuotas,
      and(
        eq(tenantMemberUsageQuotas.tenantId, tenantMembers.tenantId),
        eq(tenantMemberUsageQuotas.authUserId, tenantMembers.authUserId)
      )
    )
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.isActive, true)
      )
    );

  let allocatedCents = 0;
  for (const row of activeMembers) {
    if (row.authUserId === args.authUserId) {
      allocatedCents += nextCents ?? perSeat;
      continue;
    }
    allocatedCents += row.overrideCents ?? perSeat;
  }

  if (allocatedCents > poolCents) {
    throw new Error(
      "This exceeds the workspace pool so lower another member’s quota to free up room."
    );
  }

  if (nextCents == null) {
    await db
      .delete(tenantMemberUsageQuotas)
      .where(
        and(
          eq(tenantMemberUsageQuotas.tenantId, args.tenantId),
          eq(tenantMemberUsageQuotas.authUserId, args.authUserId)
        )
      );
    return {
      isCustomQuota: false,
      monthlyQuotaUsdCents: null as number | null,
    };
  }

  await db
    .insert(tenantMemberUsageQuotas)
    .values({
      authUserId: args.authUserId,
      monthlyQuotaUsdCents: nextCents,
      tenantId: args.tenantId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      set: {
        monthlyQuotaUsdCents: nextCents,
        updatedAt: new Date(),
      },
      target: [
        tenantMemberUsageQuotas.tenantId,
        tenantMemberUsageQuotas.authUserId,
      ],
    });

  return { isCustomQuota: true, monthlyQuotaUsdCents: nextCents };
}

/** Clear every custom member quota — everyone back to per-seat default. */
export async function resetAllTenantMemberUsageQuotas(tenantId: string) {
  await db
    .delete(tenantMemberUsageQuotas)
    .where(eq(tenantMemberUsageQuotas.tenantId, tenantId));
  return { reset: true as const };
}

export async function getMemberUsageQuotaMap(tenantId: string) {
  const settings = await ensureTenantUsageSettings(tenantId);
  const perSeat = settings.monthlyAllowanceUsdCents;
  const overrides = await db
    .select()
    .from(tenantMemberUsageQuotas)
    .where(eq(tenantMemberUsageQuotas.tenantId, tenantId));
  const map = new Map<
    string,
    { quotaUsdCents: number; isCustomQuota: boolean }
  >();
  for (const row of overrides) {
    map.set(row.authUserId, {
      isCustomQuota: true,
      quotaUsdCents: row.monthlyQuotaUsdCents,
    });
  }
  return { overrides: map, perSeatAllowanceUsdCents: perSeat };
}

/** Snapshot for hard-limit checks and top-up overage debiting. */
export async function getTenantUsageGateSnapshot(args: {
  tenantId: string;
  authUserId?: string | null;
}) {
  const settings = await ensureTenantUsageSettings(args.tenantId);
  const billing = await getTenantBilling(args.tenantId);
  const activeSeatCount = await countActiveTenantSeats(args.tenantId);
  const seatCount = resolveBillableSeatCount({
    activeSeatCount,
    paidSeatQuantity: billing?.seatQuantity ?? 0,
    subscribed: isTenantSubscriptionActive(billing),
  });
  const perSeatAllowanceUsdCents = settings.monthlyAllowanceUsdCents;
  const allowanceUsdCents = seatCount * perSeatAllowanceUsdCents;
  const { periodStart, periodEnd } = await resolveTenantUsagePeriod(
    args.tenantId
  );

  const [workspaceAgg] = await db
    .select({
      usedUsdMicros: sum(tenantUsageEvents.estimatedCostUsdMicros),
    })
    .from(tenantUsageEvents)
    .where(
      and(
        eq(tenantUsageEvents.tenantId, args.tenantId),
        gte(tenantUsageEvents.createdAt, periodStart),
        lt(tenantUsageEvents.createdAt, periodEnd)
      )
    );

  const workspaceUsedUsdMicros = Number(workspaceAgg?.usedUsdMicros ?? 0);

  let memberQuotaUsdCents = perSeatAllowanceUsdCents;
  let memberUsedUsdMicros = 0;
  if (args.authUserId) {
    const [override] = await db
      .select({
        monthlyQuotaUsdCents: tenantMemberUsageQuotas.monthlyQuotaUsdCents,
      })
      .from(tenantMemberUsageQuotas)
      .where(
        and(
          eq(tenantMemberUsageQuotas.tenantId, args.tenantId),
          eq(tenantMemberUsageQuotas.authUserId, args.authUserId)
        )
      )
      .limit(1);
    if (override) {
      memberQuotaUsdCents = override.monthlyQuotaUsdCents;
    }

    const [memberAgg] = await db
      .select({
        usedUsdMicros: sum(tenantUsageEvents.estimatedCostUsdMicros),
      })
      .from(tenantUsageEvents)
      .where(
        and(
          eq(tenantUsageEvents.tenantId, args.tenantId),
          eq(tenantUsageEvents.authUserId, args.authUserId),
          gte(tenantUsageEvents.createdAt, periodStart),
          lt(tenantUsageEvents.createdAt, periodEnd)
        )
      );
    memberUsedUsdMicros = Number(memberAgg?.usedUsdMicros ?? 0);
  }

  return {
    allowanceUsdCents,
    billing,
    memberQuotaUsdCents,
    memberUsedUsdMicros,
    periodEnd,
    periodStart,
    perSeatAllowanceUsdCents,
    seatCount,
    topUpBalanceUsdCents: billing?.topUpBalanceUsdCents ?? 0,
    workspaceUsedUsdMicros,
  };
}
