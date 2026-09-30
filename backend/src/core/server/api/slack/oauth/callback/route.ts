import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { parseSignedOAuthStateCookie } from "@/core/lib/connectors/oauth/oauth-state";
import { toTenantUserId } from "@/core/lib/db/queries";
import {
  getTenantSlackIntegrationOAuthCredentials,
  saveTenantSlackIntegrationInstall,
} from "@/core/lib/db/slack-integration-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { getSlackIntegrationOAuthRedirectUri } from "@/core/lib/slack-integration/oauth";
import { safeAppReturnTo } from "@/core/lib/tenant/safe-return-to";

type SlackIntegrationInstallState = {
  nonce: string;
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  returnTo: string;
};

function redirectToAdmin(
  base: string,
  returnTo: string,
  params: Record<string, string>
) {
  const url = new URL(returnTo, base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return Response.redirect(url.toString(), 302);
}

export async function GET(request: Request) {
  const appBase =
    process.env.BETTER_AUTH_URL ??
    process.env.KIMIRO_WEB_ORIGIN ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:5173";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieStore = requestCookies();
  const rawState = cookieStore.get("slack_integration_oauth_state")?.value;
  cookieStore.delete("slack_integration_oauth_state");

  const payload =
    parseSignedOAuthStateCookie<SlackIntegrationInstallState>(rawState);
  const returnTo = safeAppReturnTo(
    payload?.returnTo,
    payload?.tenantSlug ?? "",
    "/admin/slack-integration"
  );

  if (errorParam) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError: `Slack denied access: ${errorParam}`,
    });
  }
  if (!code || !state || !payload) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError: "Missing OAuth code or state from Slack.",
    });
  }
  if (payload.nonce !== state) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError: "OAuth state mismatch.",
    });
  }

  const authResult = await assertTenantCapabilityRequest(
    payload.tenantSlug,
    request,
    `admin:${payload.tenantSlug}:slack-integration`,
    "admin.slack_integration"
  );
  if ("error" in authResult) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError: "Admin session required to finish Slack install.",
    });
  }
  if (authResult.tenant.id !== payload.tenantId) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError: "Tenant mismatch during Slack install.",
    });
  }

  const oauthCredentials = await getTenantSlackIntegrationOAuthCredentials(
    authResult.tenant.id
  );
  if (!oauthCredentials) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError: "Slack integration OAuth is not configured.",
    });
  }

  const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
    body: new URLSearchParams({
      client_id: oauthCredentials.clientId,
      client_secret: oauthCredentials.clientSecret,
      code,
      redirect_uri: getSlackIntegrationOAuthRedirectUri(),
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    access_token?: string;
    team?: { id?: string; name?: string };
    bot_user_id?: string;
  } | null;

  if (!(tokenResponse.ok && tokenPayload?.ok && tokenPayload.access_token)) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError:
        tokenPayload?.error ?? "Failed to exchange Slack OAuth code.",
    });
  }

  const teamId = tokenPayload.team?.id?.trim();
  const teamName = tokenPayload.team?.name?.trim();
  const botUserId = tokenPayload.bot_user_id?.trim();
  if (!(teamId && teamName && botUserId)) {
    return redirectToAdmin(appBase, returnTo, {
      slackIntegrationError: "Slack install response was incomplete.",
    });
  }

  await saveTenantSlackIntegrationInstall({
    botToken: tokenPayload.access_token,
    botUserId,
    installedByUserId: toTenantUserId(authResult.userId),
    slackTeamId: teamId,
    slackTeamName: teamName,
    tenantId: authResult.tenant.id,
  });

  return redirectToAdmin(appBase, returnTo, { slackIntegrationInstalled: "1" });
}
