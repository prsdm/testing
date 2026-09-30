import { evaluateFreeTrialAccess } from "@/core/lib/billing/free-trial";
import { centsToMicros } from "@/core/lib/billing/usage-cost";
import {
  getTenantBilling,
  isTenantSubscriptionActive,
} from "@/core/lib/db/billing-queries";
import {
  countTenantUsageEventsForUser,
  getTenantUsageGateSnapshot,
  isTenantFounder,
} from "@/core/lib/db/usage-queries";

export type UsageGateDenial = {
  allowed: false;
  code:
    | "not_subscribed"
    | "free_trial_exhausted"
    | "personal_quota"
    | "workspace_pool";
  message: string;
};

export type UsageGateAllow = {
  allowed: true;
};

export type UsageGateResult = UsageGateAllow | UsageGateDenial;

/**
 * Hard-limit check before starting an AI turn.
 *
 * - Active subscription → personal quota + workspace pool / top-up.
 * - No subscription → only the workspace founder may use up to 5 free queries;
 *   then they must subscribe. Invited users never get free queries.
 */
export async function assertTenantUsageAllowed(args: {
  tenantId: string;
  authUserId: string;
}): Promise<UsageGateResult> {
  const billing = await getTenantBilling(args.tenantId);
  if (!isTenantSubscriptionActive(billing)) {
    const [isFounder, queriesUsed] = await Promise.all([
      isTenantFounder({
        authUserId: args.authUserId,
        tenantId: args.tenantId,
      }),
      countTenantUsageEventsForUser({
        authUserId: args.authUserId,
        tenantId: args.tenantId,
      }),
    ]);
    const trial = evaluateFreeTrialAccess({ isFounder, queriesUsed });
    if (!trial.allowed) {
      return {
        allowed: false,
        code: trial.code,
        message: trial.message,
      };
    }
    return { allowed: true };
  }

  const snap = await getTenantUsageGateSnapshot({
    authUserId: args.authUserId,
    tenantId: args.tenantId,
  });

  const memberQuotaMicros = centsToMicros(snap.memberQuotaUsdCents);
  if (snap.memberUsedUsdMicros >= memberQuotaMicros && memberQuotaMicros > 0) {
    return {
      allowed: false,
      code: "personal_quota",
      message:
        "Your personal AI usage quota for this period is exhausted. Ask a workspace admin to raise your quota or wait for the next billing period.",
    };
  }

  const poolMicros = centsToMicros(snap.allowanceUsdCents);
  const topUpCents = snap.topUpBalanceUsdCents;
  if (
    snap.workspaceUsedUsdMicros >= poolMicros &&
    poolMicros > 0 &&
    topUpCents <= 0
  ) {
    return {
      allowed: false,
      code: "workspace_pool",
      message:
        "This workspace has used its included AI allowance and has no top-up balance left. An admin can buy a top-up or wait for the next billing period.",
    };
  }

  return { allowed: true };
}
