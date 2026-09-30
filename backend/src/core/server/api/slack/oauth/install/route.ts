import crypto from "node:crypto";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  oauthStateCookieOptions,
  signOAuthStateCookie,
} from "@/core/lib/connectors/oauth/oauth-state";
import { getTenantSlackIntegrationOAuthCredentials } from "@/core/lib/db/slack-integration-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { getSlackIntegrationOAuthRedirectUri } from "@/core/lib/slack-integration/oauth";
import { SLACK_INTEGRATION_OAUTH_SCOPES } from "@/core/lib/slack-integration/scopes";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug")?.trim();
  const returnTo = url.searchParams.get("returnTo")?.trim();
  if (!tenantSlug) {
    return new Response("Missing tenantSlug query parameter.", { status: 400 });
  }

  const authResult = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:slack-integration`,
    "admin.slack_integration"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const oauthCredentials = await getTenantSlackIntegrationOAuthCredentials(
    authResult.tenant.id
  );
  if (!oauthCredentials) {
    return new Response(
      "Slack integration OAuth is not configured. Save credentials on Admin → Slack integration first.",
      { status: 503 }
    );
  }

  const safeReturnTo = safeAppReturnTo(returnTo, authResult.tenant.slug);
  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = signOAuthStateCookie({
    nonce,
    returnTo: safeReturnTo,
    tenantId: authResult.tenant.id,
    tenantSlug: authResult.tenant.slug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });

  const cookieStore = requestCookies();
  const cookieOptions = oauthStateCookieOptions();
  cookieStore.set("slack_integration_oauth_state", statePayload, cookieOptions);

  const authUrl = new URL("https://slack.com/oauth/v2/authorize");
  authUrl.searchParams.set("client_id", oauthCredentials.clientId);
  authUrl.searchParams.set("scope", SLACK_INTEGRATION_OAUTH_SCOPES.join(","));
  authUrl.searchParams.set(
    "redirect_uri",
    getSlackIntegrationOAuthRedirectUri()
  );
  authUrl.searchParams.set("state", nonce);

  return Response.redirect(authUrl.toString(), 302);
}
