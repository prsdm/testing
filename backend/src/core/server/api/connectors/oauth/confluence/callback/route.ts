import { assertConnectorAccountMatchesUserEmail } from "@/core/lib/connectors/account-email-policy";
import {
  assertOAuthCallbackAccess,
  sanitizeOAuthCallbackReturnTo,
} from "@/core/lib/connectors/oauth/callback-guards";
import { parseSignedOAuthStateCookie } from "@/core/lib/connectors/oauth/oauth-state";
import {
  fetchAccessibleConfluenceResources,
  fetchConfluenceProfile,
} from "@/core/lib/connectors/providers/confluence/auth";
import { confluenceToolIdsForConnector } from "@/core/lib/connectors/providers/confluence/chat-tools";
import { getConfluenceOAuthRedirectUri } from "@/core/lib/connectors/providers/confluence/oauth";
import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import { DEFAULT_CONFLUENCE_OAUTH_SCOPES } from "@/core/lib/connectors/providers/confluence/scopes";
import { getTenantConfluenceActionsOAuthCredentials } from "@/core/lib/db/confluence-actions-queries";
import {
  createConnectorRow,
  createCredentialRow,
  deleteConfluenceConnectorForTenantUser,
  replaceToolConfigsForConnector,
} from "@/core/lib/db/connector-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { encryptSecret } from "@/core/lib/security/crypto";

interface ConfluenceStatePayload {
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
    url.searchParams.set("confluenceConnected", "1");
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
  const rawState = cookieStore.get("confluence_oauth_state")?.value;
  cookieStore.delete("confluence_oauth_state");

  const payload = parseSignedOAuthStateCookie<ConfluenceStatePayload>(rawState);
  const returnTo = sanitizeOAuthCallbackReturnTo(
    payload?.returnTo,
    payload?.tenantSlug ?? ""
  );

  if (errorParam) {
    return redirectToConnectors(
      appBase,
      returnTo,
      `Confluence denied access: ${errorParam}`
    );
  }
  if (!code || !state || !payload) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Missing code or state from Confluence."
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

  const oauthCredentials =
    await getTenantConfluenceActionsOAuthCredentials(tenantId);
  if (!oauthCredentials) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Confluence actions are not configured."
    );
  }

  const tokenResponse = await fetch("https://auth.atlassian.com/oauth/token", {
    body: JSON.stringify({
      client_id: oauthCredentials.clientId,
      client_secret: oauthCredentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getConfluenceOAuthRedirectUri(),
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  }).catch(() => null);
  if (!tokenResponse?.ok) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Failed to exchange Confluence code for token."
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
      "Confluence token exchange failed."
    );
  }

  const profile = await fetchConfluenceProfile(tokens.access_token).catch(
    () => null
  );
  if (!profile?.email) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Confluence account email could not be verified."
    );
  }

  try {
    assertConnectorAccountMatchesUserEmail({
      providerAccountEmail: profile.email,
      providerLabel: "Confluence account",
      userEmail: payload.userEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Confluence account is not allowed for this workspace.";
    return redirectToConnectors(appBase, returnTo, message);
  }

  const resources = await fetchAccessibleConfluenceResources(
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
      "Your Confluence account cannot access the configured workspace site."
    );
  }

  const toolIds = confluenceToolIdsForConnector();

  const scope = tokens.scope ?? DEFAULT_CONFLUENCE_OAUTH_SCOPES.join(" ");
  const normalizedScopes = scope
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const secretPayload = JSON.stringify({
    access_token: tokens.access_token,
    cloud_id: resource.id,
    confluence_account_id: profile?.accountId ?? null,
    expires_at: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : null,
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
    await deleteConfluenceConnectorForTenantUser({
      tenantId,
      userId: payload.userId,
    });
    const credRow = await createCredentialRow({
      name: payload.name,
      oauthScopes:
        normalizedScopes.length > 0
          ? normalizedScopes
          : [...DEFAULT_CONFLUENCE_OAUTH_SCOPES],
      plainSecret: secretPayload,
      provider: CONFLUENCE_PROVIDER_ID,
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
      tools: [{ providerId: CONFLUENCE_PROVIDER_ID, toolIds: [...toolIds] }],
      userId: payload.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectToConnectors(
      appBase,
      returnTo,
      `Failed to save Confluence connection: ${message}`
    );
  }

  return redirectToConnectors(appBase, returnTo);
}
