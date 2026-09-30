import { ensureFreshConfluenceAccessToken } from "@/core/lib/connectors/providers/confluence/credential-token";
import { getTenantConfluenceActionsConfig } from "@/core/lib/db/confluence-actions-queries";
import { getConfluenceConnectorForTenantUser } from "@/core/lib/db/connector-queries";
import { isConfluenceIntegrationReady } from "@/core/lib/integrations/integration-readiness";

function normalizeSiteUrl(siteUrl: string) {
  const trimmed = siteUrl.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) {
    throw new Error("Confluence site URL must start with https://");
  }
  return trimmed;
}

export async function getConfluenceAccessForUser(args: {
  tenantId: string;
  userId: string;
}): Promise<
  | {
      ok: true;
      siteUrl: string;
      cloudId: string;
      accessToken: string;
    }
  | { ok: false; error: string }
> {
  const config = await getTenantConfluenceActionsConfig(args.tenantId);
  if (!isConfluenceIntegrationReady(config) || !config.siteUrl) {
    return {
      error: "Confluence is not configured by admin.",
      ok: false,
    };
  }
  const adminSiteUrl = config.siteUrl;
  if (!config.allowRead) {
    return { error: "Confluence read is disabled by admin.", ok: false };
  }

  const connection = await getConfluenceConnectorForTenantUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connection) {
    return { error: "Confluence account is not connected.", ok: false };
  }

  try {
    const token = await ensureFreshConfluenceAccessToken({
      credentialId: connection.credentialId,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    if (normalizeSiteUrl(token.siteUrl) !== normalizeSiteUrl(adminSiteUrl)) {
      return {
        error:
          "Confluence workspace changed by admin. Reconnect your Confluence account.",
        ok: false,
      };
    }
    return {
      accessToken: token.accessToken,
      cloudId: token.cloudId,
      ok: true,
      siteUrl: normalizeSiteUrl(config.siteUrl),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Confluence site URL is invalid.",
      ok: false,
    };
  }
}
