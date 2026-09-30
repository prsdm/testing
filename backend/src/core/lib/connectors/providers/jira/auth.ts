import { getTenantJiraActionsOAuthCredentials } from "@/core/lib/db/jira-actions-queries";

export async function fetchJiraProfile(accessToken: string) {
  const response = await fetch("https://api.atlassian.com/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch Jira account profile.");
  }
  const payload = (await response.json()) as {
    email?: string;
    account_id?: string;
  };
  return {
    accountId: payload.account_id ?? null,
    email: payload.email?.trim().toLowerCase() ?? null,
  };
}

export async function fetchAccessibleJiraResources(accessToken: string) {
  const response = await fetch(
    "https://api.atlassian.com/oauth/token/accessible-resources",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to list accessible Jira resources.");
  }
  return (await response.json()) as Array<{
    id: string;
    url?: string;
    name?: string;
    scopes?: string[];
  }>;
}

export async function assertJiraActionAllowed(args: { tenantId: string }) {
  const credentials = await getTenantJiraActionsOAuthCredentials(args.tenantId);
  if (!credentials) {
    throw new Error("Jira actions are disabled by admin.");
  }
  if (!credentials.settings.siteUrl) {
    throw new Error("Jira site is not configured by admin.");
  }
}
