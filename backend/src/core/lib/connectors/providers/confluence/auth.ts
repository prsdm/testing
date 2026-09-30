import { getTenantConfluenceActionsOAuthCredentials } from "@/core/lib/db/confluence-actions-queries";

export async function fetchConfluenceProfile(accessToken: string) {
  const response = await fetch("https://api.atlassian.com/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error("Failed to fetch Confluence account profile.");
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

export async function fetchAccessibleConfluenceResources(accessToken: string) {
  const response = await fetch(
    "https://api.atlassian.com/oauth/token/accessible-resources",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to list accessible Confluence resources.");
  }
  return (await response.json()) as Array<{
    id: string;
    url?: string;
    name?: string;
    scopes?: string[];
  }>;
}

export async function assertConfluenceActionAllowed(input: {
  tenantId: string;
  action: "read" | "create" | "write";
}) {
  const credentials = await getTenantConfluenceActionsOAuthCredentials(
    input.tenantId
  );
  if (!credentials) {
    throw new Error("Confluence actions are disabled by admin.");
  }
  if (!credentials.settings.siteUrl) {
    throw new Error("Confluence site is not configured by admin.");
  }
  if (input.action === "read" && !credentials.settings.allowRead) {
    throw new Error("Confluence sync/read is disabled by admin policy.");
  }
}
