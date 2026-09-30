import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
import { JIRA_PROVIDER_ID } from "@/core/lib/connectors/providers/registry";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import { SLACK_PROVIDER_ID } from "@/core/lib/connectors/providers/slack/provider";
import { syncGoogleAppChatToolsForUser } from "@/core/lib/connectors/sync-google-chat-tools";
import { syncProductivityChatToolsForUser } from "@/core/lib/connectors/sync-productivity-chat-tools";
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
import type { IntegrationKey } from "@/shared/integrations/integration-catalog";

export async function listChatToolConfigIdsForUser(args: {
  tenantId: string;
  userId: string;
}): Promise<string[]> {
  const [
    driveConfig,
    confluenceConfig,
    notionConfig,
    sharePointConfig,
    slackConfig,
    jiraConfig,
  ] = await Promise.all([
    getTenantDriveActionsConfig(args.tenantId),
    getTenantConfluenceActionsConfig(args.tenantId),
    getTenantNotionActionsConfig(args.tenantId),
    getTenantSharePointActionsConfig(args.tenantId),
    getTenantSlackActionsConfig(args.tenantId),
    getTenantJiraActionsConfig(args.tenantId),
  ]);

  const isDriveOAuthReady = isDriveOAuthConfigured(driveConfig);
  const isNotionOAuthReady = isNotionOAuthConfigured(notionConfig);
  const isConfluenceOAuthReady = isConfluenceIntegrationReady(confluenceConfig);
  const isSharePointOAuthReady = isSharePointOAuthConfigured(sharePointConfig);
  const isSlackOAuthReady = isSlackOAuthConfigured(slackConfig);
  const isJiraOAuthReady = isJiraIntegrationReady(jiraConfig);

  async function isWorkspaceEnabled(key: IntegrationKey, oauthReady: boolean) {
    if (!oauthReady) {
      return false;
    }
    return await isIntegrationAvailableToAuthUser({
      authUserId: args.userId,
      integrationKey: key,
      tenantId: args.tenantId,
    });
  }

  const [
    isDriveEnabled,
    isGmailEnabled,
    isCalendarEnabled,
    isConfluenceEnabled,
    isNotionEnabled,
    isSharePointEnabled,
    isSlackEnabled,
    isJiraEnabled,
  ] = await Promise.all([
    isWorkspaceEnabled("google-drive", isDriveOAuthReady),
    isWorkspaceEnabled("gmail", isDriveOAuthReady),
    isWorkspaceEnabled("google-calendar", isDriveOAuthReady),
    isWorkspaceEnabled("confluence", isConfluenceOAuthReady),
    isWorkspaceEnabled("notion", isNotionOAuthReady),
    isWorkspaceEnabled("sharepoint", isSharePointOAuthReady),
    isWorkspaceEnabled("slack", isSlackOAuthReady),
    isWorkspaceEnabled("jira", isJiraOAuthReady),
  ]);

  await Promise.all([
    isDriveEnabled || isGmailEnabled || isCalendarEnabled
      ? syncGoogleAppChatToolsForUser(args)
      : Promise.resolve(),
    syncProductivityChatToolsForUser({
      ...args,
      confluenceEnabled: isConfluenceEnabled,
      notionEnabled: isNotionEnabled,
      sharePointEnabled: isSharePointEnabled,
    }),
  ]);

  const [
    driveToolConfigIds,
    gmailToolConfigIds,
    calendarToolConfigIds,
    confluenceToolConfigIds,
    notionToolConfigIds,
    sharePointToolConfigIds,
    slackToolConfigIds,
    jiraToolConfigIds,
  ] = await Promise.all([
    listActiveToolConfigIdsForTenantUser({
      providerId: GOOGLE_DRIVE_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    listActiveToolConfigIdsForTenantUser({
      providerId: GMAIL_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    listActiveToolConfigIdsForTenantUser({
      providerId: GOOGLE_CALENDAR_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    listActiveToolConfigIdsForTenantUser({
      providerId: CONFLUENCE_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    listActiveToolConfigIdsForTenantUser({
      providerId: NOTION_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    listActiveToolConfigIdsForTenantUser({
      providerId: SHAREPOINT_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    listActiveToolConfigIdsForTenantUser({
      providerId: SLACK_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    listActiveToolConfigIdsForTenantUser({
      providerId: JIRA_PROVIDER_ID,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
  ]);

  const allCandidateIds = [
    ...(isDriveEnabled ? driveToolConfigIds : []),
    ...(isGmailEnabled ? gmailToolConfigIds : []),
    ...(isCalendarEnabled ? calendarToolConfigIds : []),
    ...(isConfluenceEnabled ? confluenceToolConfigIds : []),
    ...(isNotionEnabled ? notionToolConfigIds : []),
    ...(isSharePointEnabled ? sharePointToolConfigIds : []),
    ...(isSlackEnabled ? slackToolConfigIds : []),
    ...(isJiraEnabled ? jiraToolConfigIds : []),
  ];
  return [...new Set(allCandidateIds)];
}
