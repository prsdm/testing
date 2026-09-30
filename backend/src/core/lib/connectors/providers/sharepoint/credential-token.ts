import {
  getCredentialRowByIdForTenant,
  updateCredentialSecret,
} from "@/core/lib/db/connector-queries";
import { getTenantSharePointActionsOAuthCredentials } from "@/core/lib/db/sharepoint-actions-queries";
import { decryptSecret } from "@/core/lib/security/crypto";
import { getSharePointOAuthRedirectUri } from "./oauth";

type OAuthSecretPayload = {
  access_token?: string;
  refresh_token?: string | null;
  token_type?: string;
  scope?: string;
  expires_at?: number | null;
  tenant_id?: string | null;
  user_email?: string | null;
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

async function refreshSharePointAccessToken(args: {
  tenantId: string;
  refreshToken: string;
}) {
  const oauthCredentials = await getTenantSharePointActionsOAuthCredentials(
    args.tenantId
  );
  if (!oauthCredentials) {
    throw new Error("SharePoint integration is not configured.");
  }

  const response = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      body: new URLSearchParams({
        client_id: oauthCredentials.clientId,
        client_secret: oauthCredentials.clientSecret,
        grant_type: "refresh_token",
        redirect_uri: getSharePointOAuthRedirectUri(),
        refresh_token: args.refreshToken,
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to refresh SharePoint access token.");
  }
  return (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
  };
}

export async function ensureFreshSharePointAccessToken(args: {
  credentialId: string;
  tenantId: string;
  userId: string;
}): Promise<{ accessToken: string; tenantId: string | null }> {
  const credential = await getCredentialRowByIdForTenant({
    id: args.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!credential?.enabled) {
    throw new Error("SharePoint credential not found.");
  }

  const payload = parseOAuthSecret(credential.secretEncrypted);
  if (!payload.access_token) {
    throw new Error("SharePoint credential is incomplete.");
  }

  if (!isExpired(payload.expires_at)) {
    return {
      accessToken: payload.access_token,
      tenantId: payload.tenant_id ?? null,
    };
  }
  if (!payload.refresh_token) {
    throw new Error("SharePoint is not connected. Reconnect SharePoint.");
  }

  const refreshed = await refreshSharePointAccessToken({
    refreshToken: payload.refresh_token,
    tenantId: args.tenantId,
  });
  if (!refreshed.access_token) {
    throw new Error("SharePoint is not connected. Reconnect SharePoint.");
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
    tenantId: nextPayload.tenant_id ?? null,
  };
}
