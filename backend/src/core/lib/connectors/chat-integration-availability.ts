import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
import { JIRA_PROVIDER_ID } from "@/core/lib/connectors/providers/registry";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import { SLACK_PROVIDER_ID } from "@/core/lib/connectors/providers/slack/provider";
import { getTenantConfluenceActionsConfig } from "@/core/lib/db/confluence-actions-queries";
import { listActiveToolConfigIdsForTenantUser } from "@/core/lib/db/connector-queries";
import { getTenantDriveActionsConfig } from "@/core/lib/db/drive-actions-queries";
import { getTenantJiraActionsConfig } from "@/core/lib/db/jira-actions-queries";
import { getTenantNotionActionsConfig } from "@/core/lib/db/notion-actions-queries";
import { getTenantSharePointActionsConfig } from "@/core/lib/db/sharepoint-actions-queries";
import { getTenantSlackActionsConfig } from "@/core/lib/db/slack-actions-queries";
import { isIntegrationAvailableToAuthUser } from "@/core/lib/integrations/integration-admin";
import {
  isConfluenceIntegrationReady,
  isDriveOAuthConfigured,
  isJiraIntegrationReady,
  isNotionOAuthConfigured,
  isSharePointOAuthConfigured,
  isSlackOAuthConfigured,
} from "@/core/lib/integrations/integration-readiness";
import { GMAIL_PROVIDER_ID } from "@/shared/connectors/providers/gmail/provider";
import { GOOGLE_CALENDAR_PROVIDER_ID } from "@/shared/connectors/providers/google-calendar/provider";
import { GOOGLE_DRIVE_PROVIDER_ID } from "@/shared/connectors/providers/google-drive/provider";
import {
  getIntegrationCatalogEntry,
  type IntegrationKey,
} from "@/shared/integrations/integration-catalog";
import { getBlockedToolIdsForLatentIntegrations } from "./latent-tool-substitution";
import { oauthConnectPathForIntegration } from "./oauth-connect-url";

export type LatentChatIntegration = {
  integrationKey: IntegrationKey;
  providerId: string;
  displayName: string;
  connectUrl: string;
  connectLabel: string;
};

type IntegrationAvailabilitySpec = {
  key: IntegrationKey;
  providerId: string;
  isOAuthReady: (configs: IntegrationOAuthConfigs) => boolean;
};

type IntegrationOAuthConfigs = {
  driveConfig: Awaited<ReturnType<typeof getTenantDriveActionsConfig>>;
  confluenceConfig: Awaited<
    ReturnType<typeof getTenantConfluenceActionsConfig>
  >;
  notionConfig: Awaited<ReturnType<typeof getTenantNotionActionsConfig>>;
  sharePointConfig: Awaited<
    ReturnType<typeof getTenantSharePointActionsConfig>
  >;
  slackConfig: Awaited<ReturnType<typeof getTenantSlackActionsConfig>>;
  jiraConfig: Awaited<ReturnType<typeof getTenantJiraActionsConfig>>;
};

const INTEGRATION_AVAILABILITY_SPECS: IntegrationAvailabilitySpec[] = [
  {
    isOAuthReady: (configs) => isDriveOAuthConfigured(configs.driveConfig),
    key: "google-drive",
    providerId: GOOGLE_DRIVE_PROVIDER_ID,
  },
  {
    isOAuthReady: (configs) => isDriveOAuthConfigured(configs.driveConfig),
    key: "gmail",
    providerId: GMAIL_PROVIDER_ID,
  },
  {
    isOAuthReady: (configs) => isDriveOAuthConfigured(configs.driveConfig),
    key: "google-calendar",
    providerId: GOOGLE_CALENDAR_PROVIDER_ID,
  },
  {
    isOAuthReady: (configs) =>
      isConfluenceIntegrationReady(configs.confluenceConfig),
    key: "confluence",
    providerId: CONFLUENCE_PROVIDER_ID,
  },
  {
    isOAuthReady: (configs) => isNotionOAuthConfigured(configs.notionConfig),
    key: "notion",
    providerId: NOTION_PROVIDER_ID,
  },
  {
    isOAuthReady: (configs) =>
      isSharePointOAuthConfigured(configs.sharePointConfig),
    key: "sharepoint",
    providerId: SHAREPOINT_PROVIDER_ID,
  },
  {
    isOAuthReady: (configs) => isSlackOAuthConfigured(configs.slackConfig),
    key: "slack",
    providerId: SLACK_PROVIDER_ID,
  },
  {
    isOAuthReady: (configs) => isJiraIntegrationReady(configs.jiraConfig),
    key: "jira",
    providerId: JIRA_PROVIDER_ID,
  },
];

export async function getLatentChatIntegrationState(args: {
  tenantId: string;
  userId: string;
  tenantSlug: string;
}): Promise<{
  latentIntegrations: LatentChatIntegration[];
  blockedToolIds: Set<string>;
}> {
  const oauthConfigs: IntegrationOAuthConfigs = {
    confluenceConfig: await getTenantConfluenceActionsConfig(args.tenantId),
    driveConfig: await getTenantDriveActionsConfig(args.tenantId),
    jiraConfig: await getTenantJiraActionsConfig(args.tenantId),
    notionConfig: await getTenantNotionActionsConfig(args.tenantId),
    sharePointConfig: await getTenantSharePointActionsConfig(args.tenantId),
    slackConfig: await getTenantSlackActionsConfig(args.tenantId),
  };

  const latentIntegrations: LatentChatIntegration[] = [];

  for (const spec of INTEGRATION_AVAILABILITY_SPECS) {
    if (!spec.isOAuthReady(oauthConfigs)) {
      continue;
    }

    const workspaceEnabled = await isIntegrationAvailableToAuthUser({
      authUserId: args.userId,
      integrationKey: spec.key,
      tenantId: args.tenantId,
    });
    if (!workspaceEnabled) {
      continue;
    }

    const activeToolConfigIds = await listActiveToolConfigIdsForTenantUser({
      providerId: spec.providerId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    if (activeToolConfigIds.length > 0) {
      continue;
    }

    const catalogEntry = getIntegrationCatalogEntry(spec.key);
    if (!catalogEntry) {
      continue;
    }

    latentIntegrations.push({
      connectLabel: `Connect ${catalogEntry.name}`,
      connectUrl: oauthConnectPathForIntegration(args.tenantSlug, catalogEntry),
      displayName: catalogEntry.name,
      integrationKey: spec.key,
      providerId: spec.providerId,
    });
  }

  return {
    blockedToolIds: getBlockedToolIdsForLatentIntegrations(
      latentIntegrations.map((integration) => integration.integrationKey)
    ),
    latentIntegrations,
  };
}
