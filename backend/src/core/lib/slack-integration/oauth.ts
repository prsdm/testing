function slackIntegrationPublicBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ??
    process.env.KIMIRO_WEB_ORIGIN ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:5173"
  );
}

export function getSlackIntegrationOAuthRedirectUri() {
  return `${slackIntegrationPublicBaseUrl()}/api/slack/oauth/callback`;
}

export function getSlackIntegrationEventsRequestUrl() {
  return `${slackIntegrationPublicBaseUrl()}/api/slack/events`;
}

export function getSlackIntegrationInteractionsRequestUrl() {
  return `${slackIntegrationPublicBaseUrl()}/api/slack/interactions`;
}
