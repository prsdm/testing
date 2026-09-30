/**
 * Product free trial: first workspace user only, before a paid plan.
 * Once seats are subscribed, normal paid quotas apply instead.
 */

export const FREE_TRIAL_QUERY_LIMIT = 5;

export type FreeTrialEvaluation =
  | { allowed: true; remaining: number }
  | {
      allowed: false;
      code: "not_subscribed" | "free_trial_exhausted";
      message: string;
    };

/**
 * Pure free-trial decision (no DB).
 * Non-founders never get free queries without a subscription.
 */
export function evaluateFreeTrialAccess(args: {
  isFounder: boolean;
  queriesUsed: number;
  limit?: number;
}): FreeTrialEvaluation {
  const limit = args.limit ?? FREE_TRIAL_QUERY_LIMIT;
  const used = Math.max(0, Math.floor(args.queriesUsed));

  if (!args.isFounder) {
    return {
      allowed: false,
      code: "not_subscribed",
      message:
        "This workspace needs an active subscription to use AI. Ask an admin to subscribe in Admin → Billing.",
    };
  }

  if (used >= limit) {
    return {
      allowed: false,
      code: "free_trial_exhausted",
      message: `You've reached your free limit of ${limit} queries. Subscribe in Admin → Billing to keep using AI.`,
    };
  }

  return { allowed: true, remaining: limit - used };
}
