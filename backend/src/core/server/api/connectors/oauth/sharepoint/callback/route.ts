import { Buffer } from "node:buffer";
import { assertConnectorAccountMatchesUserEmail } from "@/core/lib/connectors/account-email-policy";
import {
  assertOAuthCallbackAccess,
  sanitizeOAuthCallbackReturnTo,
} from "@/core/lib/connectors/oauth/callback-guards";
import { parseSignedOAuthStateCookie } from "@/core/lib/connectors/oauth/oauth-state";
import { sharePointToolIdsForConnector } from "@/core/lib/connectors/providers/sharepoint/chat-tools";
import { getSharePointOAuthRedirectUri } from "@/core/lib/connectors/providers/sharepoint/oauth";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import { DEFAULT_SHAREPOINT_OAUTH_SCOPES } from "@/core/lib/connectors/providers/sharepoint/scopes";
import {
  createConnectorRow,
  createCredentialRow,
  deleteSharePointConnectorForTenantUser,
  replaceToolConfigsForConnector,
} from "@/core/lib/db/connector-queries";
import { getTenantSharePointActionsOAuthCredentials } from "@/core/lib/db/sharepoint-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { encryptSecret } from "@/core/lib/security/crypto";

interface SharePointStatePayload {
  name: string;
  nonce: string;
  returnTo: string;
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
    url.searchParams.set("sharePointConnected", "1");
  }
  return Response.redirect(url.toString(), 302);
}

function parseJwtClaims(idToken: string | undefined) {
  if (!idToken) {
    return null;
  }
  const parts = idToken.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const claims = JSON.parse(
      Buffer.from(parts[1] ?? "", "base64url").toString("utf-8")
    ) as {
      tid?: string;
      email?: string;
      preferred_username?: string;
    };
    return claims;
  } catch {
    return null;
  }
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
  const rawState = cookieStore.get("sharepoint_oauth_state")?.value;
  cookieStore.delete("sharepoint_oauth_state");

  const payload = parseSignedOAuthStateCookie<SharePointStatePayload>(rawState);
  const returnTo = sanitizeOAuthCallbackReturnTo(
    payload?.returnTo,
    payload?.tenantSlug ?? ""
  );

  if (errorParam) {
    return redirectToConnectors(
      appBase,
      returnTo,
      `SharePoint denied access: ${errorParam}`
    );
  }
  if (!code || !state || !payload) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Missing code or state from SharePoint."
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
    await getTenantSharePointActionsOAuthCredentials(tenantId);
  if (!oauthCredentials) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "SharePoint integration is not configured."
    );
  }

  const tokenResponse = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      body: new URLSearchParams({
        client_id: oauthCredentials.clientId,
        client_secret: oauthCredentials.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: getSharePointOAuthRedirectUri(),
        scope: DEFAULT_SHAREPOINT_OAUTH_SCOPES.join(" "),
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }
  ).catch(() => null);
  if (!tokenResponse?.ok) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Failed to exchange SharePoint code for token."
    );
  }
  const tokens = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
    id_token?: string;
  };
  if (!tokens.access_token) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "SharePoint token exchange failed."
    );
  }

  const claims = parseJwtClaims(tokens.id_token);
  const microsoftAccountEmail =
    claims?.email?.trim().toLowerCase() ??
    claims?.preferred_username?.trim().toLowerCase() ??
    null;

  if (!microsoftAccountEmail?.includes("@")) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Microsoft account email could not be verified."
    );
  }

  try {
    assertConnectorAccountMatchesUserEmail({
      providerAccountEmail: microsoftAccountEmail,
      providerLabel: "Microsoft account",
      userEmail: payload.userEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Microsoft account is not allowed for this workspace.";
    return redirectToConnectors(appBase, returnTo, message);
  }

  const scope =
    tokens.scope?.trim() || DEFAULT_SHAREPOINT_OAUTH_SCOPES.join(" ");
  const secretPayload = JSON.stringify({
    access_token: tokens.access_token,
    expires_at: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : null,
    refresh_token: tokens.refresh_token ?? null,
    scope,
    tenant_id: claims?.tid ?? null,
    token_type: tokens.token_type ?? "Bearer",
    user_email: microsoftAccountEmail,
  });
  const connectionConfig = encryptSecret(
    JSON.stringify({
      providerTenantId: claims?.tid ?? null,
      tenantId,
      tenantSlug,
      userEmail: payload.userEmail.toLowerCase(),
    })
  );

  const toolIds = sharePointToolIdsForConnector();

  try {
    await deleteSharePointConnectorForTenantUser({
      tenantId,
      userId: payload.userId,
    });
    const credRow = await createCredentialRow({
      name: payload.name,
      oauthScopes: [...DEFAULT_SHAREPOINT_OAUTH_SCOPES],
      plainSecret: secretPayload,
      provider: SHAREPOINT_PROVIDER_ID,
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
      tools: [{ providerId: SHAREPOINT_PROVIDER_ID, toolIds: [...toolIds] }],
      userId: payload.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectToConnectors(
      appBase,
      returnTo,
      `Failed to save SharePoint connection: ${message}`
    );
  }

  return redirectToConnectors(appBase, returnTo);
}
