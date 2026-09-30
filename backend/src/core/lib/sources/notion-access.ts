import { ensureFreshNotionAccessToken } from "@/core/lib/connectors/providers/notion/credential-token";
import { getNotionConnectorForTenantUser } from "@/core/lib/db/connector-queries";
import { getTenantNotionActionsConfig } from "@/core/lib/db/notion-actions-queries";
import { isNotionOAuthConfigured } from "@/core/lib/integrations/integration-readiness";

export async function getNotionAccessForUser(args: {
  tenantId: string;
  userId: string;
}): Promise<
  | {
      ok: true;
      accessToken: string;
      workspaceName: string | null;
      workspaceId: string | null;
    }
  | { ok: false; error: string }
> {
  const config = await getTenantNotionActionsConfig(args.tenantId);
  if (!isNotionOAuthConfigured(config)) {
    return { error: "Notion is not configured by admin.", ok: false };
  }
  if (!config.allowRead) {
    return { error: "Notion read is disabled by admin.", ok: false };
  }

  const connection = await getNotionConnectorForTenantUser({
    tenantId: args.tenantId,
    userId: args.userId,
  });
  if (!connection) {
    return { error: "Notion account is not connected.", ok: false };
  }

  const token = await ensureFreshNotionAccessToken({
    credentialId: connection.credentialId,
    tenantId: args.tenantId,
    userId: args.userId,
  });
  return {
    accessToken: token.accessToken,
    ok: true,
    workspaceId: token.workspaceId,
    workspaceName: token.workspaceName,
  };
}
