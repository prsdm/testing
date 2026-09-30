import crypto from "node:crypto";
import {
  oauthStateCookieOptions,
  signOAuthStateCookie,
} from "@/core/lib/connectors/oauth/oauth-state";
import { getNotionOAuthRedirectUri } from "@/core/lib/connectors/providers/notion/oauth";
import {
  requireSessionUser,
  resolveTenantForUser,
} from "@/core/lib/connectors/providers/notion/request-context";
import { DEFAULT_NOTION_OAUTH_SCOPES } from "@/core/lib/connectors/providers/notion/scopes";
import { getTenantNotionActionsOAuthCredentials } from "@/core/lib/db/notion-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug")?.trim();
  const name = url.searchParams.get("name")?.trim() ?? "Notion";
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

  const oauthCredentials = await getTenantNotionActionsOAuthCredentials(
    tenant.id
  );
  if (!oauthCredentials) {
    return new Response("Notion actions are not configured.", { status: 503 });
  }

  const safeReturnTo = safeAppReturnTo(returnTo, tenant.slug);

  const nonce = crypto.randomBytes(16).toString("hex");
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
  cookieStore.set(
    "notion_oauth_state",
    statePayload,
    oauthStateCookieOptions()
  );

  const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  authUrl.searchParams.set("client_id", oauthCredentials.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("owner", "user");
  authUrl.searchParams.set("redirect_uri", getNotionOAuthRedirectUri());
  authUrl.searchParams.set("state", nonce);
  authUrl.searchParams.set("scope", DEFAULT_NOTION_OAUTH_SCOPES.join(","));

  return Response.redirect(authUrl.toString(), 302);
}
