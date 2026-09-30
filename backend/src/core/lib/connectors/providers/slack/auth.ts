import { getTenantSlackActionsOAuthCredentials } from "@/core/lib/db/slack-actions-queries";

export async function assertSlackActionAllowed(input: { tenantId: string }) {
  const credentials = await getTenantSlackActionsOAuthCredentials(
    input.tenantId
  );
  if (!credentials) {
    throw new Error("Slack integration is disabled by admin.");
  }
}
