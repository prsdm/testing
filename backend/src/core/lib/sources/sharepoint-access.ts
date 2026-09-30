import { ensureFreshSharePointAccessToken } from "@/core/lib/connectors/providers/sharepoint/credential-token";
import { getSharePointConnectorForTenantUser } from "@/core/lib/db/connector-queries";
import { getTenantSharePointActionsConfig } from "@/core/lib/db/sharepoint-actions-queries";
import { isSharePointOAuthConfigured } from "@/core/lib/integrations/integration-readiness";

export async function getSharePointAccessForUser(args: {
  tenantId: string;
  userId: string;
}): Promise<
  | {
      ok: true;
      accessToken: string;
      providerTenantId: string | null;
    }
  | { ok: false; error: string }
> {
  const config = await getTenantSharePointActionsConfig(args.tenantId);
  if (!isSharePointOAuthConfigured(config)) {
    return {
      error: "SharePoint is not configured by admin.",
      ok: false,
    };
  }
  if (!config.allowRead) {
    return { error: "SharePoint read is disabled by admin.", ok: false };
  }

  const connection = await getSharePointConnectorForTenantUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connection) {
    return { error: "SharePoint account is not connected.", ok: false };
  }

  const token = await ensureFreshSharePointAccessToken({
    credentialId: connection.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  return {
    accessToken: token.accessToken,
    ok: true,
    providerTenantId: token.tenantId,
  };
}
