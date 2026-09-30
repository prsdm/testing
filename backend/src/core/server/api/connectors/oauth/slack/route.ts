import crypto from "node:crypto";
import {
  oauthStateCookieOptions,
  signOAuthStateCookie,
} from "@/core/lib/connectors/oauth/oauth-state";
import { getSlackOAuthRedirectUri } from "@/core/lib/connectors/providers/slack/oauth";
import { createSlackPkcePair } from "@/core/lib/connectors/providers/slack/pkce";
import {
  requireSessionUser,
  resolveTenantForUser,
} from "@/core/lib/connectors/providers/slack/request-context";
import { DEFAULT_SLACK_OAUTH_USER_SCOPES } from "@/core/lib/connectors/providers/slack/scopes";
import { getTenantSlackActionsOAuthCredentials } from "@/core/lib/db/slack-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug")?.trim();
  const name = url.searchParams.get("name")?.trim() ?? "Slack";
  const returnTo = url.searchParams.get("returnTo")?.trim();
  if (!tenantSlug) {
    return new Response("Missing tenantSlug query parameter.", { status: 400 });
  }

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

  const oauthCredentials = await getTenantSlackActionsOAuthCredentials(
    tenant.id
  );
  if (!oauthCredentials) {
    return new Response("Slack integration is not configured.", {
      status: 503,
    });
  }

  const safeReturnTo = safeAppReturnTo(returnTo, tenant.slug);

  const nonce = crypto.randomBytes(16).toString("hex");
  const { codeVerifier, codeChallenge } = createSlackPkcePair();
  const statePayload = signOAuthStateCookie({
    name,
    nonce,
    returnTo: safeReturnTo,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    userEmail: user.email,
    userId: user.id,
  });

  const cookieStore = requestCookies();
  const cookieOptions = oauthStateCookieOptions();
  cookieStore.set("slack_oauth_state", statePayload, cookieOptions);
  cookieStore.set("slack_oauth_pkce", codeVerifier, cookieOptions);

  const authUrl = new URL("https://slack.com/oauth/v2/authorize");
  authUrl.searchParams.set("client_id", oauthCredentials.clientId);
  authUrl.searchParams.set(
    "user_scope",
    DEFAULT_SLACK_OAUTH_USER_SCOPES.join(",")
  );
  authUrl.searchParams.set("redirect_uri", getSlackOAuthRedirectUri());
  authUrl.searchParams.set("state", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return Response.redirect(authUrl.toString(), 302);
}
