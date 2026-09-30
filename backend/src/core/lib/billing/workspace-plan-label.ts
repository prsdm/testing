import { getFreeTrialStatusForUser } from "@/core/lib/billing/free-trial-status";
import {
  getTenantBilling,
  isTenantSubscriptionActive,
} from "@/core/lib/db/billing-queries";

export async function getWorkspacePlanLabelForUser(args: {
  authUserId: string;
  tenantId: string;
}): Promise<string | null> {
  const billing = await getTenantBilling(args.tenantId);
  if (isTenantSubscriptionActive(billing)) {
    return "Pro";
  }

  const trial = await getFreeTrialStatusForUser(args);
  if (trial.active) {
    return trial.exhausted ? "Free trial ended" : "Free trial";
  }

  return null;
}
