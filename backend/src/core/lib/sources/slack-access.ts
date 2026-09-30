import { ensureFreshSlackAccessToken } from "@/core/lib/connectors/providers/slack/credential-token";
import { getSlackConnectorForTenantUser } from "@/core/lib/db/connector-queries";
import { getIntegrationAvailability } from "@/core/lib/db/integration-availability-queries";
import { getTenantSlackActionsConfig } from "@/core/lib/db/slack-actions-queries";
import { getTenantMemberIdForAuthUser } from "@/core/lib/integrations/integration-admin";
import { isSlackOAuthConfigured } from "@/core/lib/integrations/integration-readiness";

function isIntegrationAvailableToMember(
  availability: {
    isEnabled: boolean;
    availabilityMode: string;
    memberIds: string[];
  },
  memberId: string | null
) {
  if (!memberId) {
    return false;
  }
  if (!availability.isEnabled) {
    return false;
  }
  if (availability.availabilityMode === "everyone") {
    return true;
  }
  return availability.memberIds.includes(memberId);
}

export async function getSlackAccessForUser(args: {
  tenantId: string;
  userId: string;
}) {
  const [slackConfig, connection, memberId, availability] = await Promise.all([
    getTenantSlackActionsConfig(args.tenantId),
    getSlackConnectorForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    getTenantMemberIdForAuthUser({
      authUserId: args.userId,
      tenantId: args.tenantId,
    }),
    getIntegrationAvailability(args.tenantId, "slack"),
  ]);

  if (!isSlackOAuthConfigured(slackConfig)) {
    return {
      error: "Slack is not configured for this organization.",
      ok: false as const,
    };
  }

  if (!isIntegrationAvailableToMember(availability, memberId)) {
    return {
      error: "Slack is not available for your account.",
      ok: false as const,
    };
  }

  if (!connection) {
    return {
      error: "Connect Slack on the Connectors page first.",
      ok: false as const,
    };
  }

  const token = await ensureFreshSlackAccessToken({
    credentialId: connection.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return {
    accessToken: token.accessToken,
    ok: true as const,
    teamUrl: token.teamUrl,
  };
}
