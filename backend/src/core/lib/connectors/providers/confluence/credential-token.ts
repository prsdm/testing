import { getTenantConfluenceActionsOAuthCredentials } from "@/core/lib/db/confluence-actions-queries";
import {
  getCredentialRowByIdForTenant,
  updateCredentialSecret,
} from "@/core/lib/db/connector-queries";
import { decryptSecret } from "@/core/lib/security/crypto";
import { getConfluenceOAuthRedirectUri } from "./oauth";

type OAuthSecretPayload = {
  access_token?: string;
  refresh_token?: string | null;
  token_type?: string;
  scope?: string;
  expires_at?: number | null;
  user_email?: string | null;
  confluence_account_id?: string | null;
  cloud_id?: string | null;
  site_url?: string | null;
};

function parseOAuthSecret(secretEncrypted: string): OAuthSecretPayload {
  try {
    return JSON.parse(decryptSecret(secretEncrypted)) as OAuthSecretPayload;
  } catch {
    return {};
  }
}

function isExpired(expiresAt: number | null | undefined) {
  if (expiresAt === undefined || expiresAt === null) {
    return false;
  }
  return Date.now() >= expiresAt - 60_000;
}

async function refreshConfluenceAccessToken(args: {
  tenantId: string;
  refreshToken: string;
}) {
  const oauthCredentials = await getTenantConfluenceActionsOAuthCredentials(
    args.tenantId
  );
  if (!oauthCredentials) {
    throw new Error(
      "Confluence actions are not configured for this organization."
    );
  }
  const response = await fetch("https://auth.atlassian.com/oauth/token", {
    body: JSON.stringify({
      client_id: oauthCredentials.clientId,
      client_secret: oauthCredentials.clientSecret,
      grant_type: "refresh_token",
      redirect_uri: getConfluenceOAuthRedirectUri(),
      refresh_token: args.refreshToken,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to refresh Confluence access token.");
  }
  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };
}

export async function ensureFreshConfluenceAccessToken(args: {
  credentialId: string;
  tenantId: string;
  userId: string;
}): Promise<{ accessToken: string; cloudId: string; siteUrl: string }> {
  const credential = await getCredentialRowByIdForTenant({
    id: args.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!credential?.enabled) {
    throw new Error("Confluence credential not found.");
  }

  const payload = parseOAuthSecret(credential.secretEncrypted);
  if (!payload.access_token || !payload.cloud_id || !payload.site_url) {
    throw new Error("Confluence credential is incomplete.");
  }

  if (!isExpired(payload.expires_at)) {
    return {
      accessToken: payload.access_token,
      cloudId: payload.cloud_id,
      siteUrl: payload.site_url,
    };
  }
  if (!payload.refresh_token) {
    throw new Error("Confluence is not connected. Reconnect Confluence.");
  }

  const refreshed = await refreshConfluenceAccessToken({
    refreshToken: payload.refresh_token,
    tenantId: args.tenantId,
  });
  if (!refreshed.access_token) {
    throw new Error("Confluence is not connected. Reconnect Confluence.");
  }

  const nextPayload: OAuthSecretPayload = {
    ...payload,
    access_token: refreshed.access_token,
    expires_at: refreshed.expires_in
      ? Date.now() + refreshed.expires_in * 1000
      : (payload.expires_at ?? null),
    refresh_token: refreshed.refresh_token ?? payload.refresh_token,
    scope: refreshed.scope ?? payload.scope,
    token_type: refreshed.token_type ?? payload.token_type ?? "Bearer",
  };

  await updateCredentialSecret({
    id: args.credentialId,
    plainSecret: JSON.stringify(nextPayload),
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return {
    accessToken: refreshed.access_token,
    cloudId: payload.cloud_id,
    siteUrl: payload.site_url,
  };
}
