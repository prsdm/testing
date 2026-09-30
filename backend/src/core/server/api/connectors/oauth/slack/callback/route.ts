import { assertConnectorAccountMatchesUserEmail } from "@/core/lib/connectors/account-email-policy";
import {
  assertOAuthCallbackAccess,
  sanitizeOAuthCallbackReturnTo,
} from "@/core/lib/connectors/oauth/callback-guards";
import { parseSignedOAuthStateCookie } from "@/core/lib/connectors/oauth/oauth-state";
import { slackApi } from "@/core/lib/connectors/providers/slack/api";
import { slackToolIdsForConnector } from "@/core/lib/connectors/providers/slack/chat-tools";
import { buildSlackCredentialSecretPayload } from "@/core/lib/connectors/providers/slack/credential-token";
import { getSlackOAuthRedirectUri } from "@/core/lib/connectors/providers/slack/oauth";
import { SLACK_PROVIDER_ID } from "@/core/lib/connectors/providers/slack/provider";
import { DEFAULT_SLACK_OAUTH_USER_SCOPES } from "@/core/lib/connectors/providers/slack/scopes";
import {
  createConnectorRow,
  createCredentialRow,
  deleteSlackConnectorForTenantUser,
  replaceToolConfigsForConnector,
} from "@/core/lib/db/connector-queries";
import { getTenantSlackActionsOAuthCredentials } from "@/core/lib/db/slack-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { encryptSecret } from "@/core/lib/security/crypto";

interface SlackStatePayload {
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
    url.searchParams.set("slackConnected", "1");
  }
  return Response.redirect(url.toString(), 302);
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
  const rawState = cookieStore.get("slack_oauth_state")?.value;
  const codeVerifier = cookieStore.get("slack_oauth_pkce")?.value;
  cookieStore.delete("slack_oauth_state");
  cookieStore.delete("slack_oauth_pkce");

  const payload = parseSignedOAuthStateCookie<SlackStatePayload>(rawState);
  const returnTo = sanitizeOAuthCallbackReturnTo(
    payload?.returnTo,
    payload?.tenantSlug ?? ""
  );

  if (errorParam) {
    return redirectToConnectors(
      appBase,
      returnTo,
      `Slack denied access: ${errorParam}`
    );
  }
  if (!code || !state || !payload || !codeVerifier) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Missing code, state, or PKCE verifier from Slack."
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
    await getTenantSlackActionsOAuthCredentials(tenantId);
  if (!oauthCredentials) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Slack integration is not configured."
    );
  }

  const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
    body: new URLSearchParams({
      client_id: oauthCredentials.clientId,
      client_secret: oauthCredentials.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: getSlackOAuthRedirectUri(),
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  }).catch(() => null);
  if (!tokenResponse?.ok) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Failed to exchange Slack code for token."
    );
  }

  const tokens = (await tokenResponse.json()) as {
    ok?: boolean;
    error?: string;
    authed_user?: {
      id?: string;
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    team?: { id?: string; name?: string };
  };
  if (!tokens.ok) {
    return redirectToConnectors(
      appBase,
      returnTo,
      `Slack token exchange failed: ${tokens.error ?? "unknown_error"}`
    );
  }

  const accessToken = tokens.authed_user?.access_token?.trim();
  if (!accessToken) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Slack did not return a user access token."
    );
  }

  let teamUrl: string | null = null;
  let slackUserEmail: string | null = null;
  try {
    const authTest = await slackApi<{
      ok: boolean;
      url?: string;
    }>("auth.test", accessToken);
    teamUrl = authTest.url?.trim() ?? null;
  } catch {
    teamUrl = null;
  }

  const slackUserId = tokens.authed_user?.id?.trim();
  if (slackUserId) {
    try {
      const userInfo = await slackApi<{
        ok: boolean;
        user?: { profile?: { email?: string } };
      }>("users.info", accessToken, { user: slackUserId });
      slackUserEmail =
        userInfo.user?.profile?.email?.trim().toLowerCase() ?? null;
    } catch {
      slackUserEmail = null;
    }
  }

  if (!slackUserEmail) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Slack account email could not be verified."
    );
  }

  try {
    assertConnectorAccountMatchesUserEmail({
      providerAccountEmail: slackUserEmail,
      providerLabel: "Slack account",
      userEmail: payload.userEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Slack account is not allowed for this workspace.";
    return redirectToConnectors(appBase, returnTo, message);
  }

  const toolIds = slackToolIdsForConnector();
  const scope =
    tokens.authed_user?.scope ?? DEFAULT_SLACK_OAUTH_USER_SCOPES.join(",");
  const secretPayload = buildSlackCredentialSecretPayload({
    accessToken,
    expiresIn: tokens.authed_user?.expires_in ?? null,
    refreshToken: tokens.authed_user?.refresh_token ?? null,
    scope,
    teamId: tokens.team?.id ?? null,
    teamName: tokens.team?.name ?? null,
    teamUrl,
    userEmail: slackUserEmail,
    userId: slackUserId ?? null,
  });
  const connectionConfig = encryptSecret(
    JSON.stringify({
      teamId: tokens.team?.id ?? null,
      tenantId,
      tenantSlug,
      userEmail: payload.userEmail.toLowerCase(),
    })
  );

  try {
    await deleteSlackConnectorForTenantUser({
      tenantId,
      userId: payload.userId,
    });
    const credRow = await createCredentialRow({
      name: payload.name,
      oauthScopes: [...DEFAULT_SLACK_OAUTH_USER_SCOPES],
      plainSecret: secretPayload,
      provider: SLACK_PROVIDER_ID,
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
      tools: [{ providerId: SLACK_PROVIDER_ID, toolIds: [...toolIds] }],
      userId: payload.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectToConnectors(
      appBase,
      returnTo,
      `Failed to save Slack connection: ${message}`
    );
  }

  return redirectToConnectors(appBase, returnTo);
}
