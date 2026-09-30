import { migrateLegacyUnifiedGoogleConnectorIfNeeded } from "@/core/lib/connectors/providers/google-shared/queries";
import { getTenantConfluenceActionsConfig } from "@/core/lib/db/confluence-actions-queries";
import {
  getConfluenceConnectorForTenantUser,
  getGoogleDriveConnectorForTenantUser,
  getNotionConnectorForTenantUser,
  getSharePointConnectorForTenantUser,
  getSlackConnectorForTenantUser,
} from "@/core/lib/db/connector-queries";
import { getTenantDriveActionsConfig } from "@/core/lib/db/drive-actions-queries";
import type { IntegrationAvailabilityState } from "@/core/lib/db/integration-availability-queries";
import { getIntegrationAvailability } from "@/core/lib/db/integration-availability-queries";
import { getTenantNotionActionsConfig } from "@/core/lib/db/notion-actions-queries";
import { getTenantSharePointActionsConfig } from "@/core/lib/db/sharepoint-actions-queries";
import { getTenantSlackActionsConfig } from "@/core/lib/db/slack-actions-queries";
import { getTenantMemberIdForAuthUser } from "@/core/lib/integrations/integration-admin";
import {
  isConfluenceIntegrationReady,
  isDriveOAuthConfigured,
  isNotionOAuthConfigured,
  isSharePointOAuthConfigured,
  isSlackOAuthConfigured,
} from "@/core/lib/integrations/integration-readiness";

function isIntegrationAvailableToMember(
  availability: IntegrationAvailabilityState,
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

export type KnowledgeConnectorPinFlags = {
  drivePinEnabled: boolean;
  confluencePinEnabled: boolean;
  notionPinEnabled: boolean;
  sharePointPinEnabled: boolean;
  slackPinEnabled: boolean;
};

/** Batched connector pin flags for the Knowledge page (no repeated auth/tenant lookups). */
export async function getKnowledgeConnectorPinFlags(args: {
  tenantId: string;
  userId: string;
}): Promise<KnowledgeConnectorPinFlags> {
  await migrateLegacyUnifiedGoogleConnectorIfNeeded({
    tenantId: args.tenantId,
    userId: args.userId,
  });

  const [
    driveConfig,
    confluenceConfig,
    notionConfig,
    sharePointConfig,
    slackConfig,
    driveConnection,
    confluenceConnection,
    notionConnection,
    sharePointConnection,
    slackConnection,
    memberId,
    driveAvailability,
    confluenceAvailability,
    notionAvailability,
    sharePointAvailability,
    slackAvailability,
  ] = await Promise.all([
    getTenantDriveActionsConfig(args.tenantId),
    getTenantConfluenceActionsConfig(args.tenantId),
    getTenantNotionActionsConfig(args.tenantId),
    getTenantSharePointActionsConfig(args.tenantId),
    getTenantSlackActionsConfig(args.tenantId),
    getGoogleDriveConnectorForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    getConfluenceConnectorForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    getNotionConnectorForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    getSharePointConnectorForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    getSlackConnectorForTenantUser({
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    getTenantMemberIdForAuthUser({
      authUserId: args.userId,
      tenantId: args.tenantId,
    }),
    getIntegrationAvailability(args.tenantId, "google-drive"),
    getIntegrationAvailability(args.tenantId, "confluence"),
    getIntegrationAvailability(args.tenantId, "notion"),
    getIntegrationAvailability(args.tenantId, "sharepoint"),
    getIntegrationAvailability(args.tenantId, "slack"),
  ]);

  const driveWorkspaceAvailable = isIntegrationAvailableToMember(
    driveAvailability,
    memberId
  );
  const confluenceWorkspaceAvailable = isIntegrationAvailableToMember(
    confluenceAvailability,
    memberId
  );
  const notionWorkspaceAvailable = isIntegrationAvailableToMember(
    notionAvailability,
    memberId
  );
  const sharePointWorkspaceAvailable = isIntegrationAvailableToMember(
    sharePointAvailability,
    memberId
  );
  const slackWorkspaceAvailable = isIntegrationAvailableToMember(
    slackAvailability,
    memberId
  );

  const driveOAuthConfigured =
    isDriveOAuthConfigured(driveConfig) && driveWorkspaceAvailable;
  const confluenceTenantReady =
    isConfluenceIntegrationReady(confluenceConfig) &&
    confluenceWorkspaceAvailable;
  const notionOAuthConfigured =
    isNotionOAuthConfigured(notionConfig) && notionWorkspaceAvailable;
  const sharePointOAuthConfigured =
    isSharePointOAuthConfigured(sharePointConfig) &&
    sharePointWorkspaceAvailable;
  const slackOAuthConfigured =
    isSlackOAuthConfigured(slackConfig) && slackWorkspaceAvailable;

  return {
    confluencePinEnabled:
      confluenceTenantReady &&
      Boolean(confluenceConnection) &&
      confluenceConfig.allowRead,
    drivePinEnabled:
      driveOAuthConfigured && Boolean(driveConnection) && driveConfig.allowRead,
    notionPinEnabled:
      notionOAuthConfigured &&
      Boolean(notionConnection) &&
      notionConfig.allowRead,
    sharePointPinEnabled:
      sharePointOAuthConfigured &&
      Boolean(sharePointConnection) &&
      sharePointConfig.allowRead,
    slackPinEnabled: slackOAuthConfigured && Boolean(slackConnection),
  };
}
