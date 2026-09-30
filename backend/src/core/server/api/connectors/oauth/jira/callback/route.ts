import { assertConnectorAccountMatchesUserEmail } from "@/core/lib/connectors/account-email-policy";
import {
  assertOAuthCallbackAccess,
  sanitizeOAuthCallbackReturnTo,
} from "@/core/lib/connectors/oauth/callback-guards";
import { parseSignedOAuthStateCookie } from "@/core/lib/connectors/oauth/oauth-state";
import {
  fetchAccessibleJiraResources,
  fetchJiraProfile,
} from "@/core/lib/connectors/providers/jira/auth";
import { jiraToolIdsForConnector } from "@/core/lib/connectors/providers/jira/chat-tools";
import { getJiraOAuthRedirectUri } from "@/core/lib/connectors/providers/jira/oauth";
import { JIRA_PROVIDER_ID } from "@/core/lib/connectors/providers/jira/provider";
import { DEFAULT_JIRA_OAUTH_SCOPES } from "@/core/lib/connectors/providers/jira/scopes";
import {
  createConnectorRow,
  createCredentialRow,
  deleteJiraConnectorForTenantUser,
  replaceToolConfigsForConnector,
} from "@/core/lib/db/connector-queries";
import { getTenantJiraActionsOAuthCredentials } from "@/core/lib/db/jira-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { encryptSecret } from "@/core/lib/security/crypto";

interface JiraStatePayload {
  name: string;
  nonce: string;
  returnTo: string;
  siteUrl: string;
  tenantId: string;
  tenantSlug: string;
  userEmail: string;
  userId: string;
}

function redirectToConnectors(base: string, returnTo: string, error?: string) {
  const url = new URL(returnTo, base);
  if (error) {
    url.searchParams.set("error", error);
  } else {
    url.searchParams.set("jiraConnected", "1");
  }
  return Response.redirect(url.toString(), 302);
}

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.trim().replace(/\/+$/, "").toLowerCase();
}

export async function GET(request: Request) {
  const appBase =
    process.env.BETTER_AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3001";

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieStore = requestCookies();
  const rawState = cookieStore.get("jira_oauth_state")?.value;
  cookieStore.delete("jira_oauth_state");

  const payload = parseSignedOAuthStateCookie<JiraStatePayload>(rawState);
  const returnTo = sanitizeOAuthCallbackReturnTo(
    payload?.returnTo,
    payload?.tenantSlug ?? ""
  );

  if (errorParam) {
    return redirectToConnectors(
      appBase,
      returnTo,
      `Jira denied access: ${errorParam}`
    );
  }
  if (!code || !state || !payload) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Missing code or state from Jira."
    );
  }
  if (payload.nonce !== state) {
    return redirectToConnectors(appBase, returnTo, "OAuth state mismatch.");
  }

  const access = await assertOAuthCallbackAccess({
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    userEmail: payload.userEmail,
    userId: payload.userId,
  });
  if (!access.ok) {
    return redirectToConnectors(appBase, returnTo, access.reason);
  }
  const tenantId = access.tenant.id;
  const tenantSlug = access.tenant.slug;

  const oauthCredentials = await getTenantJiraActionsOAuthCredentials(tenantId);
  if (!oauthCredentials) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Jira actions are not configured."
    );
  }

  const tokenResponse = await fetch("https://auth.atlassian.com/oauth/token", {
    body: JSON.stringify({
      client_id: oauthCredentials.clientId,
      client_secret: oauthCredentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getJiraOAuthRedirectUri(),
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  }).catch(() => null);
  if (!tokenResponse?.ok) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Failed to exchange Jira code for token."
    );
  }
  const tokens = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };
  if (!tokens.access_token) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Jira token exchange failed."
    );
  }

  const profile = await fetchJiraProfile(tokens.access_token).catch(() => null);
  if (!profile?.email) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Jira account email could not be verified."
    );
  }

  try {
    assertConnectorAccountMatchesUserEmail({
      providerAccountEmail: profile.email,
      providerLabel: "Jira account",
      userEmail: payload.userEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Jira account is not allowed for this workspace.";
    return redirectToConnectors(appBase, returnTo, message);
  }

  const resources = await fetchAccessibleJiraResources(
    tokens.access_token
  ).catch(() => []);
  const siteUrl = normalizeSiteUrl(payload.siteUrl);
  const resource = resources.find(
    (item) => normalizeSiteUrl(item.url ?? "") === siteUrl
  );
  if (!resource?.id) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Your Jira account cannot access the configured workspace site."
    );
  }

  const toolIds = jiraToolIdsForConnector();
  const scope = tokens.scope ?? DEFAULT_JIRA_OAUTH_SCOPES.join(" ");
  const normalizedScopes = scope
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const secretPayload = JSON.stringify({
    access_token: tokens.access_token,
    cloud_id: resource.id,
    expires_at: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : null,
    jira_account_id: profile?.accountId ?? null,
    refresh_token: tokens.refresh_token ?? null,
    scope,
    site_url: payload.siteUrl,
    token_type: tokens.token_type ?? "Bearer",
    user_email: profile.email,
  });
  const connectionConfig = encryptSecret(
    JSON.stringify({
      cloudId: resource.id,
      siteUrl: payload.siteUrl,
      tenantId,
      tenantSlug,
      userEmail: payload.userEmail.toLowerCase(),
    })
  );

  try {
    await deleteJiraConnectorForTenantUser({
      tenantId,
      userId: payload.userId,
    });
    const credRow = await createCredentialRow({
      name: payload.name,
      oauthScopes:
        normalizedScopes.length > 0
          ? normalizedScopes
          : [...DEFAULT_JIRA_OAUTH_SCOPES],
      plainSecret: secretPayload,
      provider: JIRA_PROVIDER_ID,
      tenantId,
      type: "oauth2",
      userId: payload.userId,
      visibility: "private",
    });
    const connRow = await createConnectorRow({
      createdBy: payload.userId,
      name: payload.name,
      tenantId,
      userId: payload.userId,
    });
    await replaceToolConfigsForConnector({
      configEncrypted: connectionConfig,
      connectorId: connRow.id,
      credentialId: credRow.id,
      tenantId,
      tools: [{ providerId: JIRA_PROVIDER_ID, toolIds: [...toolIds] }],
      userId: payload.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectToConnectors(
      appBase,
      returnTo,
      `Failed to save Jira connection: ${message}`
    );
  }

  return redirectToConnectors(appBase, returnTo);
}
