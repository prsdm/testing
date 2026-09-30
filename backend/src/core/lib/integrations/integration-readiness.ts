type CredentialMode = "managed" | "own";

type OAuthConfigFields = {
  credentialMode: CredentialMode;
  oauthClientId: string | null;
  hasOAuthClientSecret: boolean;
};

function isManagedOAuthReady(clientId?: string, clientSecret?: string) {
  return Boolean(clientId?.trim() && clientSecret?.trim());
}

function isOwnOAuthReady(
  oauthClientId: string | null,
  hasOAuthClientSecret: boolean
) {
  return Boolean(oauthClientId?.trim()) && hasOAuthClientSecret;
}

function isOAuthConfigured(
  config: OAuthConfigFields,
  managed: { clientId?: string; clientSecret?: string }
) {
  return config.credentialMode === "managed"
    ? isManagedOAuthReady(managed.clientId, managed.clientSecret)
    : isOwnOAuthReady(config.oauthClientId, config.hasOAuthClientSecret);
}

export function isDriveOAuthConfigured(config: OAuthConfigFields) {
  return isOAuthConfigured(config, {
    clientId: process.env.KIMIRO_MANAGED_GOOGLE_CLIENT_ID,
    clientSecret: process.env.KIMIRO_MANAGED_GOOGLE_CLIENT_SECRET,
  });
}

export function isNotionOAuthConfigured(config: OAuthConfigFields) {
  return isOAuthConfigured(config, {
    clientId: process.env.KIMIRO_MANAGED_NOTION_CLIENT_ID,
    clientSecret: process.env.KIMIRO_MANAGED_NOTION_CLIENT_SECRET,
  });
}

export function isConfluenceOAuthConfigured(config: OAuthConfigFields) {
  return isOAuthConfigured(config, {
    clientId: process.env.KIMIRO_MANAGED_CONFLUENCE_CLIENT_ID,
    clientSecret: process.env.KIMIRO_MANAGED_CONFLUENCE_CLIENT_SECRET,
  });
}

export function isSharePointOAuthConfigured(config: OAuthConfigFields) {
  return isOAuthConfigured(config, {
    clientId: process.env.KIMIRO_MANAGED_SHAREPOINT_CLIENT_ID,
    clientSecret: process.env.KIMIRO_MANAGED_SHAREPOINT_CLIENT_SECRET,
  });
}

export function isSlackOAuthConfigured(config: OAuthConfigFields) {
  return isOAuthConfigured(config, {
    clientId: process.env.KIMIRO_MANAGED_SLACK_CLIENT_ID,
    clientSecret: process.env.KIMIRO_MANAGED_SLACK_CLIENT_SECRET,
  });
}

export function isJiraOAuthConfigured(config: OAuthConfigFields) {
  return isOAuthConfigured(config, {
    clientId: process.env.KIMIRO_MANAGED_JIRA_CLIENT_ID,
    clientSecret: process.env.KIMIRO_MANAGED_JIRA_CLIENT_SECRET,
  });
}

export function isConfluenceIntegrationReady(
  config: OAuthConfigFields & { siteUrl: string | null }
) {
  return Boolean(config.siteUrl?.trim()) && isConfluenceOAuthConfigured(config);
}

export function isJiraIntegrationReady(
  config: OAuthConfigFields & { siteUrl: string | null }
) {
  return Boolean(config.siteUrl?.trim()) && isJiraOAuthConfigured(config);
}
