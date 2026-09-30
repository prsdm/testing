/** Bot token scopes for workspace install (Events API + @mention + deliverables). */
export const SLACK_INTEGRATION_OAUTH_SCOPES = [
  "app_mentions:read",
  "assistant:write",
  "channels:history",
  "chat:write",
  "files:write",
  "groups:history",
  "im:history",
  "im:read",
  "users:read",
  "users:read.email",
] as const;

/** Copy into Slack app → OAuth & Permissions → Bot Token Scopes (one per line). */
export const SLACK_INTEGRATION_SETUP_SCOPE_LINES =
  SLACK_INTEGRATION_OAUTH_SCOPES.join("\n");
