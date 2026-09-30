/** User token scopes for Slack OAuth v2 (no bot scopes). */
export const DEFAULT_SLACK_OAUTH_USER_SCOPES = [
  "channels:read",
  "channels:history",
  "channels:write",
  "groups:read",
  "groups:history",
  "groups:write",
  "im:read",
  "im:history",
  "im:write",
  "mpim:history",
  "search:read",
  "chat:write",
  "users:read",
  "users:read.email",
] as const;
