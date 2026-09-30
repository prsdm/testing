import {
  evaluateFreeTrialAccess,
  FREE_TRIAL_QUERY_LIMIT,
} from "@/core/lib/billing/free-trial";
import {
  getTenantBilling,
  isTenantSubscriptionActive,
} from "@/core/lib/db/billing-queries";
import {
  countTenantUsageEventsForUser,
  isTenantFounder,
} from "@/core/lib/db/usage-queries";

export type FreeTrialStatusView =
  | {
      active: false;
    }
  | {
      active: true;
      used: number;
      remaining: number;
      limit: number;
      exhausted: boolean;
    };

/** Current user's free-trial meter for the chat UI (hidden when subscribed). */
export async function getFreeTrialStatusForUser(args: {
  tenantId: string;
  authUserId: string;
}): Promise<FreeTrialStatusView> {
  const billing = await getTenantBilling(args.tenantId);
  if (isTenantSubscriptionActive(billing)) {
    return { active: false };
  }

  const [isFounder, used] = await Promise.all([
    isTenantFounder({
      authUserId: args.authUserId,
      tenantId: args.tenantId,
    }),
    countTenantUsageEventsForUser({
      authUserId: args.authUserId,
      tenantId: args.tenantId,
    }),
  ]);

  if (!isFounder) {
    return { active: false };
  }

  const trial = evaluateFreeTrialAccess({ isFounder: true, queriesUsed: used });
  const limit = FREE_TRIAL_QUERY_LIMIT;
  if (trial.allowed) {
    return {
      active: true,
      exhausted: false,
      limit,
      remaining: trial.remaining,
      used,
    };
  }

  return {
    active: true,
    exhausted: true,
    limit,
    remaining: 0,
    used: Math.min(used, limit),
  };
}
