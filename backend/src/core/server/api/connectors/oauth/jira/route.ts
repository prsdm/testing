import crypto from "node:crypto";
import {
  oauthStateCookieOptions,
  signOAuthStateCookie,
} from "@/core/lib/connectors/oauth/oauth-state";
import { getJiraOAuthRedirectUri } from "@/core/lib/connectors/providers/jira/oauth";
import {
  requireSessionUser,
  resolveTenantForUser,
} from "@/core/lib/connectors/providers/jira/request-context";
import { DEFAULT_JIRA_OAUTH_SCOPES } from "@/core/lib/connectors/providers/jira/scopes";
import { getTenantJiraActionsOAuthCredentials } from "@/core/lib/db/jira-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug")?.trim();
  const name = url.searchParams.get("name")?.trim() ?? "Jira";
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

  const oauthCredentials = await getTenantJiraActionsOAuthCredentials(
    tenant.id
  );
  if (!oauthCredentials) {
    return new Response("Jira actions are not configured.", { status: 503 });
  }
  if (!oauthCredentials.settings.siteUrl) {
    return new Response("Jira source is not fully configured.", {
      status: 503,
    });
  }

  const safeReturnTo = safeAppReturnTo(returnTo, tenant.slug);

  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = signOAuthStateCookie({
    name,
    nonce,
    returnTo: safeReturnTo,
    siteUrl: oauthCredentials.settings.siteUrl,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    userEmail: user.email,
    userId: user.id,
  });

  const cookieStore = requestCookies();
  cookieStore.set("jira_oauth_state", statePayload, oauthStateCookieOptions());

  const authUrl = new URL("https://auth.atlassian.com/authorize");
  authUrl.searchParams.set("audience", "api.atlassian.com");
  authUrl.searchParams.set("client_id", oauthCredentials.clientId);
  authUrl.searchParams.set("scope", DEFAULT_JIRA_OAUTH_SCOPES.join(" "));
  authUrl.searchParams.set("redirect_uri", getJiraOAuthRedirectUri());
  authUrl.searchParams.set("state", nonce);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("prompt", "consent");

  return Response.redirect(authUrl.toString(), 302);
}
