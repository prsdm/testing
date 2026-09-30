import { OAuth2Client } from "google-auth-library";
import {
  assertOAuthCallbackAccess,
  sanitizeOAuthCallbackReturnTo,
} from "@/core/lib/connectors/oauth/callback-guards";
import { parseSignedOAuthStateCookie } from "@/core/lib/connectors/oauth/oauth-state";
import {
  assertGoogleAccountMatchesUserEmail,
  fetchGoogleAccountEmail,
} from "@/core/lib/connectors/providers/google-drive/auth";
import { getGoogleDriveOAuthRedirectUri } from "@/core/lib/connectors/providers/google-drive/oauth";
import {
  ensureGoogleAppConnectionRow,
  mergeGoogleCredentialSecret,
} from "@/core/lib/connectors/providers/google-shared/queries";
import { syncMissingToolConfigsForConnector } from "@/core/lib/db/connector-queries";
import { getTenantDriveActionsOAuthCredentials } from "@/core/lib/db/drive-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { encryptSecret } from "@/core/lib/security/crypto";
import {
  type GoogleAppId,
  getGoogleWorkspaceApp,
} from "@/shared/connectors/providers/google-shared/apps";

interface GdStatePayload {
  appId?: GoogleAppId;
  name: string;
  nonce: string;
  returnTo: string;
  tenantId: string;
  tenantSlug: string;
  userEmail: string;
  userId: string;
}

function redirectToConnectors(
  base: string,
  returnTo: string,
  connectedParam: string,
  error?: string
) {
  const url = new URL(returnTo, base);
  if (error) {
    url.searchParams.set("error", error);
  } else {
    url.searchParams.set(connectedParam, "1");
  }
  return Response.redirect(url.toString(), 302);
}

/** GET /api/connectors/oauth/google-drive/callback */
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
  const rawState = cookieStore.get("gd_oauth_state")?.value;
  cookieStore.delete("gd_oauth_state");

  const payload = parseSignedOAuthStateCookie<GdStatePayload>(rawState);

  const returnTo = sanitizeOAuthCallbackReturnTo(
    payload?.returnTo,
    payload?.tenantSlug ?? ""
  );
  const app = payload
    ? getGoogleWorkspaceApp(payload.appId ?? "google-drive")
    : null;
  const connectedParam = app?.connectedParam ?? "driveConnected";

  if (errorParam) {
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      `Google denied access: ${errorParam}`
    );
  }
  if (!code || !state || !payload || !app) {
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      "Missing code or state from Google."
    );
  }
  if (payload.nonce !== state) {
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      "OAuth state mismatch."
    );
  }

  const access = await assertOAuthCallbackAccess({
    tenantId: payload.tenantId,
    tenantSlug: payload.tenantSlug,
    userEmail: payload.userEmail,
    userId: payload.userId,
  });
  if (!access.ok) {
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      access.reason
    );
  }
  const tenantId = access.tenant.id;
  const tenantSlug = access.tenant.slug;

  const oauthCredentials =
    await getTenantDriveActionsOAuthCredentials(tenantId);
  if (!oauthCredentials) {
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      "Drive actions are not configured."
    );
  }

  const client = new OAuth2Client({
    clientId: oauthCredentials.clientId,
    clientSecret: oauthCredentials.clientSecret,
    redirectUri: getGoogleDriveOAuthRedirectUri(),
  });

  const tokenResponse = await client.getToken(code).catch(() => null);
  if (!tokenResponse) {
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      "Failed to exchange Google code for token."
    );
  }
  const { tokens } = tokenResponse;

  if (!tokens.access_token) {
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      "Google token exchange failed."
    );
  }

  let googleAccountEmail: string;
  try {
    googleAccountEmail = await fetchGoogleAccountEmail(tokens.access_token);
    assertGoogleAccountMatchesUserEmail({
      googleAccountEmail,
      userEmail: payload.userEmail,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Google account is not allowed for this workspace.";
    return redirectToConnectors(appBase, returnTo, connectedParam, message);
  }

  const connectionConfig = encryptSecret(
    JSON.stringify({
      tenantId,
      tenantSlug,
      userEmail: payload.userEmail.toLowerCase(),
    })
  );

  try {
    const { credentialId } = await mergeGoogleCredentialSecret({
      nextTokens: {
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date ?? undefined,
        google_account_email: googleAccountEmail,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope ?? undefined,
        token_type: tokens.token_type ?? undefined,
        user_email: payload.userEmail,
      },
      tenantId,
      userId: payload.userId,
    });

    const { connectorId } = await ensureGoogleAppConnectionRow({
      appId: payload.appId ?? "google-drive",
      tenantId,
      userId: payload.userId,
    });

    await syncMissingToolConfigsForConnector({
      configEncrypted: connectionConfig,
      connectorId,
      credentialId,
      tenantId,
      tools: [
        {
          providerId: app.providerId,
          toolIds: app.toolIds(),
        },
      ],
      userId: payload.userId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return redirectToConnectors(
      appBase,
      returnTo,
      connectedParam,
      `Failed to save ${app.connectionName} connection: ${msg}`
    );
  }

  return redirectToConnectors(appBase, returnTo, connectedParam);
}
