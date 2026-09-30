import crypto from "node:crypto";
import {
  oauthStateCookieOptions,
  signOAuthStateCookie,
} from "@/core/lib/connectors/oauth/oauth-state";
import { getGoogleDriveOAuthRedirectUri } from "@/core/lib/connectors/providers/google-drive/oauth";
import {
  requireSessionUser,
  resolveTenantForUser,
} from "@/core/lib/connectors/providers/google-drive/request-context-base";
import { getGoogleSharedCredentialForTenantUser } from "@/core/lib/connectors/providers/google-shared/queries";
import { getTenantDriveActionsOAuthCredentials } from "@/core/lib/db/drive-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";
import {
  type GoogleAppId,
  getGoogleWorkspaceApp,
  mergeGoogleOAuthScopeStrings,
  oauthScopesForAllGoogleWorkspaceApps,
  oauthScopesForGoogleApp,
} from "@/shared/connectors/providers/google-shared/apps";

/** GET /api/connectors/oauth/google-drive?tenantSlug=...&app=google-drive */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug")?.trim();
  const appParam = url.searchParams.get("app")?.trim() ?? "google-drive";
  const nameParam = url.searchParams.get("name")?.trim();
  const returnTo = url.searchParams.get("returnTo")?.trim();

  if (!tenantSlug) {
    return new Response("Missing tenantSlug query parameter.", { status: 400 });
  }

  const app = getGoogleWorkspaceApp(appParam);
  if (!app) {
    return new Response("Invalid app query parameter.", { status: 400 });
  }
  const appId = app.id as GoogleAppId;
  const name = nameParam ?? app.connectionName;

  const user = await requireSessionUser();
  if (!user?.email || !user.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tenant = await resolveTenantForUser({
    authUserId: user.id,
    tenantSlug,
    userEmail: user.email,
  });
  if (!tenant) {
    return new Response("Forbidden", { status: 403 });
  }

  const oauthCredentials = await getTenantDriveActionsOAuthCredentials(
    tenant.id
  );
  if (!oauthCredentials) {
    return new Response("Drive actions are not configured.", { status: 503 });
  }

  const safeReturnTo = safeAppReturnTo(returnTo, tenant.slug);

  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = signOAuthStateCookie({
    appId,
    name,
    nonce,
    returnTo: safeReturnTo,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    userEmail: user.email,
    userId: user.id,
  });

  const cookieStore = requestCookies();
  cookieStore.set("gd_oauth_state", statePayload, oauthStateCookieOptions());

  const existingCredential = await getGoogleSharedCredentialForTenantUser({
    requireOwned: true,
    tenantId: tenant.id,
    userId: user.id,
  });

  // Never revoke here. Revoke + per-app scopes was destroying sibling grants
  // (Drive after Gmail, etc.) and forcing users to reconnect repeatedly.
  // Request the full Workspace union (plus any already-stored scopes) so one
  // consent covers KB, chat Select/Open, Gmail, and Calendar.
  const scopeList = mergeGoogleOAuthScopeStrings(
    existingCredential?.scope ?? "",
    oauthScopesForGoogleApp(appId).join(" "),
    oauthScopesForAllGoogleWorkspaceApps().join(" ")
  );

  const needsRefreshToken = !existingCredential?.hasRefreshToken;

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", oauthCredentials.clientId);
  authUrl.searchParams.set("redirect_uri", getGoogleDriveOAuthRedirectUri());
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopeList.join(" "));
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("state", nonce);
  authUrl.searchParams.set("access_type", "offline");
  // consent only when we still need an offline refresh token; otherwise
  // select_account + include_granted_scopes expands without wiping grants.
  if (needsRefreshToken) {
    authUrl.searchParams.set("prompt", "consent");
  } else {
    authUrl.searchParams.set("prompt", "select_account");
  }

  return Response.redirect(authUrl.toString(), 302);
}
