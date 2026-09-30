import type { ConnectorProvider } from "@/contracts/connectors";
import type { GoogleAppId } from "@/shared/connectors/providers/google-shared/apps";
import type { WorkSkillId } from "@/shared/sandbox/work-skill-catalog";

type GoogleAppConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "google-app";
  initialStatus: {
    appId: GoogleAppId;
    oauthConfigured: boolean;
    connected: boolean;
    googleAccountEmail: string | null;
    policyError?: string | null;
    connectUrl: string;
    description: string;
    connectLabel: string;
    connectedParam: string;
    uiProvider: ConnectorProvider;
  };
};

type ConfluenceConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "confluence";
  initialStatus: {
    siteConfigured: boolean;
    oauthConfigured: boolean;
    tenantReady: boolean;
    connected: boolean;
    siteUrl: string | null;
    confluenceUserEmail: string | null;
    connectUrl: string;
  };
};

type NotionConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "notion";
  initialStatus: {
    oauthConfigured: boolean;
    connected: boolean;
    notionUserEmail: string | null;
    workspaceName: string | null;
    connectUrl: string;
  };
};

type SharePointConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "sharepoint";
  initialStatus: {
    oauthConfigured: boolean;
    connected: boolean;
    sharePointUserEmail: string | null;
    connectUrl: string;
  };
};

type SlackConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "slack";
  initialStatus: {
    oauthConfigured: boolean;
    connected: boolean;
    slackUserEmail: string | null;
    teamName: string | null;
    connectUrl: string;
  };
};

type JiraConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "jira";
  initialStatus: {
    siteConfigured: boolean;
    oauthConfigured: boolean;
    tenantReady: boolean;
    connected: boolean;
    siteUrl: string | null;
    jiraUserEmail: string | null;
    connectUrl: string;
  };
};

type McpConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "mcp";
  initialStatus: {
    serverId: string;
    connected: boolean;
    serverConfigured: boolean;
    transport: "sse" | "streamable_http";
  };
};

type WorkSkillConnectorItem = {
  id: string;
  name: string;
  description: string;
  kind: "work-skill";
  skillId: WorkSkillId;
};

export type ConnectorPanelItem =
  | GoogleAppConnectorItem
  | ConfluenceConnectorItem
  | NotionConnectorItem
  | SharePointConnectorItem
  | SlackConnectorItem
  | JiraConnectorItem
  | McpConnectorItem
  | WorkSkillConnectorItem;
