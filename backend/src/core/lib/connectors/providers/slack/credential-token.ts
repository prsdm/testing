import {
  getCredentialRowByIdForTenant,
  updateCredentialSecret,
} from "@/core/lib/db/connector-queries";
import { getTenantSlackActionsOAuthCredentials } from "@/core/lib/db/slack-actions-queries";
import { decryptSecret } from "@/core/lib/security/crypto";

export { buildSlackCredentialSecretPayload } from "./credential-secret";

type SlackSecretPayload = {
  access_token?: string;
  refresh_token?: string | null;
  expires_at?: number | null;
  scope?: string;
  team_id?: string | null;
  team_name?: string | null;
  team_url?: string | null;
  user_id?: string | null;
  user_email?: string | null;
};

export type SlackAccessTokenBundle = {
  accessToken: string;
  teamId: string | null;
  teamName: string | null;
  teamUrl: string | null;
  userId: string | null;
  userEmail: string | null;
};

function parseSlackSecret(secretEncrypted: string): SlackSecretPayload {
  try {
    return JSON.parse(decryptSecret(secretEncrypted)) as SlackSecretPayload;
  } catch {
    return {};
  }
}

function isExpired(expiresAt: number | null | undefined) {
  if (expiresAt === undefined || expiresAt === null) {
    // Long-lived tokens (rotation off) have no expiry — treat as fresh.
    return false;
  }
  return Date.now() >= expiresAt - 60_000;
}

function serializeSlackSecret(payload: SlackSecretPayload) {
  return JSON.stringify(payload);
}

type SlackRefreshResponse = {
  ok?: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  authed_user?: {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
};

/**
 * Refresh a rotating Slack user token. Slack issues a new refresh_token on
 * every refresh — always persist both tokens.
 */
async function refreshSlackUserAccessToken(args: {
  tenantId: string;
  refreshToken: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
  scope?: string;
}> {
  const oauthCredentials = await getTenantSlackActionsOAuthCredentials(
    args.tenantId
  );
  if (!oauthCredentials) {
    throw new Error("Slack integration is not configured.");
  }

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    body: new URLSearchParams({
      client_id: oauthCredentials.clientId,
      client_secret: oauthCredentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: args.refreshToken,
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Slack token refresh failed (${response.status}).`);
  }

  const data = (await response.json()) as SlackRefreshResponse;
  if (!data.ok) {
    throw new Error(
      `Slack connection expired. Reconnect Slack. (${data.error ?? "refresh_failed"})`
    );
  }

  const accessToken =
    data.authed_user?.access_token?.trim() || data.access_token?.trim();
  const refreshToken =
    data.authed_user?.refresh_token?.trim() ||
    data.refresh_token?.trim() ||
    args.refreshToken;
  const expiresIn = data.authed_user?.expires_in ?? data.expires_in;
  const scope = data.authed_user?.scope ?? data.scope;

  if (!accessToken) {
    throw new Error("Slack token refresh returned no access token.");
  }

  return {
    accessToken,
    expiresAt:
      typeof expiresIn === "number" && Number.isFinite(expiresIn)
        ? Date.now() + expiresIn * 1000
        : null,
    refreshToken,
    scope,
  };
}

function toBundle(payload: SlackSecretPayload): SlackAccessTokenBundle {
  if (!payload.access_token) {
    throw new Error("Slack access token missing. Reconnect Slack.");
  }
  return {
    accessToken: payload.access_token,
    teamId: payload.team_id ?? null,
    teamName: payload.team_name ?? null,
    teamUrl: payload.team_url ?? null,
    userEmail: payload.user_email ?? null,
    userId: payload.user_id ?? null,
  };
}

export async function ensureFreshSlackAccessToken(args: {
  credentialId: string;
  tenantId: string;
  userId: string;
  /** Force oauth refresh even if expires_at looks valid. */
  forceRefresh?: boolean;
}): Promise<SlackAccessTokenBundle> {
  const credential = await getCredentialRowByIdForTenant({
    id: args.credentialId,
    requireOwned: true,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!credential?.enabled) {
    throw new Error("Slack credential not found.");
  }

  const payload = parseSlackSecret(credential.secretEncrypted);
  if (!payload.access_token) {
    throw new Error("Slack access token missing. Reconnect Slack.");
  }

  if (!(args.forceRefresh || isExpired(payload.expires_at))) {
    return toBundle(payload);
  }

  const refreshToken = payload.refresh_token?.trim();
  if (!refreshToken) {
    // Token has an expiry but no refresh token — rotation was enabled after
    // connect, or secret was saved without refresh. User must reconnect once.
    throw new Error("Slack connection expired. Reconnect Slack.");
  }

  const refreshed = await refreshSlackUserAccessToken({
    refreshToken,
    tenantId: args.tenantId,
  });

  const nextPayload: SlackSecretPayload = {
    ...payload,
    access_token: refreshed.accessToken,
    expires_at: refreshed.expiresAt,
    refresh_token: refreshed.refreshToken,
    ...(refreshed.scope ? { scope: refreshed.scope } : {}),
  };

  await updateCredentialSecret({
    id: args.credentialId,
    plainSecret: serializeSlackSecret(nextPayload),
    tenantId: args.tenantId,
    userId: args.userId,
  });

  return toBundle(nextPayload);
}
