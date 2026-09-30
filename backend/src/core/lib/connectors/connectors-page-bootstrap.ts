import { getConfluenceConnectorStatus } from "@/core/lib/connectors/providers/confluence/request-context";
import { getGoogleAppConnectorStatus } from "@/core/lib/connectors/providers/google-shared/request-context";
import { getJiraConnectorStatus } from "@/core/lib/connectors/providers/jira/request-context";
import { getNotionConnectorStatus } from "@/core/lib/connectors/providers/notion/request-context";
import { getSharePointConnectorStatus } from "@/core/lib/connectors/providers/sharepoint/request-context";
import { getSlackConnectorStatus } from "@/core/lib/connectors/providers/slack/request-context";
import { listMcpServersForConnectorsPage } from "@/core/lib/db/mcp-queries";
import { getTenantBySlug } from "@/core/lib/db/queries";
import { getTenantWorkSkillsUserView } from "@/core/lib/sandbox/work-skills-user-view";
import type { ConnectorPanelItem } from "@/shared/connectors/connectors-panel-types";
import { GOOGLE_WORKSPACE_APPS } from "@/shared/connectors/providers/google-shared/apps";
import {
  compareIntegrationDisplayNames,
  getIntegrationCatalogEntry,
  type IntegrationKey,
  integrationKeyForGoogleApp,
} from "@/shared/integrations/integration-catalog";

function integrationConnectorDescription(key: IntegrationKey): string {
  return getIntegrationCatalogEntry(key)?.description ?? "";
}

export async function loadConnectorsPageBootstrap(
  tenantSlug: string,
  authUserId: string
) {
  const tenant = await getTenantBySlug(tenantSlug);
  if (tenant?.status !== "active") {
    return { error: "Not found" as const, status: 404 as const };
  }

  const workSkillsView = await getTenantWorkSkillsUserView(tenant.id);

  const [
    googleStatuses,
    confluenceStatus,
    notionStatus,
    sharePointStatus,
    slackStatus,
    jiraStatus,
  ] = await Promise.all([
    Promise.all(
      GOOGLE_WORKSPACE_APPS.map((app) =>
        getGoogleAppConnectorStatus(tenant.slug, app.id)
      )
    ),
    getConfluenceConnectorStatus(tenant.slug),
    getNotionConnectorStatus(tenant.slug),
    getSharePointConnectorStatus(tenant.slug),
    getSlackConnectorStatus(tenant.slug),
    getJiraConnectorStatus(tenant.slug),
  ]);

  const items: ConnectorPanelItem[] = [];

  for (const googleStatus of googleStatuses) {
    if ("error" in googleStatus || !googleStatus.workspaceAvailable) {
      continue;
    }

    const app = GOOGLE_WORKSPACE_APPS.find(
      (entry) => entry.id === googleStatus.appId
    );
    if (!app) {
      continue;
    }

    const integrationKey = integrationKeyForGoogleApp(googleStatus.appId);
    const description = integrationKey
      ? integrationConnectorDescription(integrationKey)
      : googleStatus.description;

    items.push({
      description,
      id: googleStatus.appId,
      initialStatus: {
        appId: googleStatus.appId,
        connected: googleStatus.connected,
        connectedParam: googleStatus.connectedParam,
        connectLabel: googleStatus.connectLabel,
        connectUrl: googleStatus.connectUrl,
        description,
        googleAccountEmail: googleStatus.googleAccountEmail,
        oauthConfigured: googleStatus.oauthConfigured,
        policyError: googleStatus.policyError,
        uiProvider: googleStatus.uiProvider,
      },
      kind: "google-app",
      name: app.connectionName,
    });
  }

  if (
    "workspaceAvailable" in confluenceStatus &&
    confluenceStatus.workspaceAvailable
  ) {
    items.push({
      description: integrationConnectorDescription("confluence"),
      id: "confluence",
      initialStatus: {
        confluenceUserEmail: confluenceStatus.confluenceUserEmail,
        connected: confluenceStatus.connected,
        connectUrl: confluenceStatus.connectUrl,
        oauthConfigured: confluenceStatus.oauthConfigured,
        siteConfigured: confluenceStatus.siteConfigured,
        siteUrl: confluenceStatus.siteUrl,
        tenantReady: confluenceStatus.tenantReady,
      },
      kind: "confluence",
      name: "Confluence",
    });
  }

  if ("workspaceAvailable" in notionStatus && notionStatus.workspaceAvailable) {
    items.push({
      description: integrationConnectorDescription("notion"),
      id: "notion",
      initialStatus: {
        connected: notionStatus.connected,
        connectUrl: notionStatus.connectUrl,
        notionUserEmail: notionStatus.notionUserEmail,
        oauthConfigured: notionStatus.oauthConfigured,
        workspaceName: notionStatus.workspaceName,
      },
      kind: "notion",
      name: "Notion",
    });
  }

  if (
    "workspaceAvailable" in sharePointStatus &&
    sharePointStatus.workspaceAvailable
  ) {
    items.push({
      description: integrationConnectorDescription("sharepoint"),
      id: "sharepoint",
      initialStatus: {
        connected: sharePointStatus.connected,
        connectUrl: sharePointStatus.connectUrl,
        oauthConfigured: sharePointStatus.oauthConfigured,
        sharePointUserEmail: sharePointStatus.sharePointUserEmail,
      },
      kind: "sharepoint",
      name: "SharePoint",
    });
  }

  if ("workspaceAvailable" in slackStatus && slackStatus.workspaceAvailable) {
    items.push({
      description: integrationConnectorDescription("slack"),
      id: "slack",
      initialStatus: {
        connected: slackStatus.connected,
        connectUrl: slackStatus.connectUrl,
        oauthConfigured: slackStatus.oauthConfigured,
        slackUserEmail: slackStatus.slackUserEmail,
        teamName: slackStatus.teamName,
      },
      kind: "slack",
      name: "Slack",
    });
  }

  if ("workspaceAvailable" in jiraStatus && jiraStatus.workspaceAvailable) {
    items.push({
      description: integrationConnectorDescription("jira"),
      id: "jira",
      initialStatus: {
        connected: jiraStatus.connected,
        connectUrl: jiraStatus.connectUrl,
        jiraUserEmail: jiraStatus.jiraUserEmail,
        oauthConfigured: jiraStatus.oauthConfigured,
        siteConfigured: jiraStatus.siteConfigured,
        siteUrl: jiraStatus.siteUrl,
        tenantReady: jiraStatus.tenantReady,
      },
      kind: "jira",
      name: "Jira",
    });
  }

  const mcpServers = await listMcpServersForConnectorsPage({
    authUserId,
    tenantId: tenant.id,
  });

  for (const server of mcpServers) {
    items.push({
      description: server.description,
      id: server.id,
      initialStatus: {
        connected: server.connected,
        serverConfigured: server.serverConfigured,
        serverId: server.id,
        transport: server.transport,
      },
      kind: "mcp",
      name: server.name,
    });
  }

  for (const skill of workSkillsView.skills) {
    items.push({
      description: skill.description,
      id: `work-skill:${skill.id}`,
      kind: "work-skill",
      name: skill.name,
      skillId: skill.id,
    });
  }

  items.sort((left, right) =>
    compareIntegrationDisplayNames(left.name, right.name)
  );

  return {
    companyName: tenant.companyName,
    items,
    tenantSlug: tenant.slug,
  };
}
