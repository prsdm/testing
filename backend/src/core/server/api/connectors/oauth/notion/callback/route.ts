import { Buffer } from "node:buffer";
import {
  assertOAuthCallbackAccess,
  sanitizeOAuthCallbackReturnTo,
} from "@/core/lib/connectors/oauth/callback-guards";
import { parseSignedOAuthStateCookie } from "@/core/lib/connectors/oauth/oauth-state";
import { notionToolIdsForConnector } from "@/core/lib/connectors/providers/notion/chat-tools";
import { getNotionOAuthRedirectUri } from "@/core/lib/connectors/providers/notion/oauth";
import { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
import { DEFAULT_NOTION_OAUTH_SCOPES } from "@/core/lib/connectors/providers/notion/scopes";
import {
  createConnectorRow,
  createCredentialRow,
  deleteNotionConnectorForTenantUser,
  replaceToolConfigsForConnector,
} from "@/core/lib/db/connector-queries";
import { getTenantNotionActionsOAuthCredentials } from "@/core/lib/db/notion-actions-queries";
import { requestCookies } from "@/core/lib/http/request-context";
import { encryptSecret } from "@/core/lib/security/crypto";

interface NotionStatePayload {
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
    url.searchParams.set("notionConnected", "1");
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
  const rawState = cookieStore.get("notion_oauth_state")?.value;
  cookieStore.delete("notion_oauth_state");

  const payload = parseSignedOAuthStateCookie<NotionStatePayload>(rawState);
  const returnTo = sanitizeOAuthCallbackReturnTo(
    payload?.returnTo,
    payload?.tenantSlug ?? ""
  );

  if (errorParam) {
    return redirectToConnectors(
      appBase,
      returnTo,
      `Notion denied access: ${errorParam}`
    );
  }
  if (!code || !state || !payload) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Missing code or state from Notion."
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
    await getTenantNotionActionsOAuthCredentials(tenantId);
  if (!oauthCredentials) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Notion actions are not configured."
    );
  }

  const basicToken = Buffer.from(
    `${oauthCredentials.clientId}:${oauthCredentials.clientSecret}`
  ).toString("base64");
  const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
    body: JSON.stringify({
      code,
      grant_type: "authorization_code",
      redirect_uri: getNotionOAuthRedirectUri(),
    }),
    headers: {
      Authorization: `Basic ${basicToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  }).catch(() => null);
  if (!tokenResponse?.ok) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Failed to exchange Notion code for token."
    );
  }
  const tokens = (await tokenResponse.json()) as {
    access_token?: string;
    token_type?: string;
    workspace_id?: string | null;
    workspace_name?: string | null;
  };
  if (!tokens.access_token) {
    return redirectToConnectors(
      appBase,
      returnTo,
      "Notion token exchange failed."
    );
  }

  const toolIds = notionToolIdsForConnector();

  const scope = DEFAULT_NOTION_OAUTH_SCOPES.join(",");
  const secretPayload = JSON.stringify({
    access_token: tokens.access_token,
    scope,
    token_type: tokens.token_type ?? "bearer",
    user_email: payload.userEmail.toLowerCase(),
    workspace_id: tokens.workspace_id ?? null,
    workspace_name: tokens.workspace_name ?? null,
  });
  const connectionConfig = encryptSecret(
    JSON.stringify({
      tenantId,
      tenantSlug,
      userEmail: payload.userEmail.toLowerCase(),
      workspaceId: tokens.workspace_id ?? null,
    })
  );

  try {
    await deleteNotionConnectorForTenantUser({
      tenantId,
      userId: payload.userId,
    });
    const credRow = await createCredentialRow({
      name: payload.name,
      oauthScopes: [...DEFAULT_NOTION_OAUTH_SCOPES],
      plainSecret: secretPayload,
      provider: NOTION_PROVIDER_ID,
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
      tools: [{ providerId: NOTION_PROVIDER_ID, toolIds: [...toolIds] }],
      userId: payload.userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return redirectToConnectors(
      appBase,
      returnTo,
      `Failed to save Notion connection: ${message}`
    );
  }

  return redirectToConnectors(appBase, returnTo);
}
