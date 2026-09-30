import { getGoogleDriveConnectorForTenantUser } from "@/core/lib/db/connector-queries";
import { getTenantDriveActionsConfig } from "@/core/lib/db/drive-actions-queries";
import { isDriveOAuthConfigured } from "@/core/lib/integrations/integration-readiness";

export async function getDriveActionsEligibility(input: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
}) {
  const [config, connection] = await Promise.all([
    getTenantDriveActionsConfig(input.tenantId),
    getGoogleDriveConnectorForTenantUser({
      tenantId: input.tenantId,
      userId: input.userId,
    }),
  ]);

  const oauthConfigured = isDriveOAuthConfigured(config);
  const tenantReady = oauthConfigured;
  const userConnected = Boolean(connection);

  return {
    canUseCreate: tenantReady && userConnected,
    canUseRead: tenantReady && userConnected && config.allowRead,
    config,
    connection: connection
      ? {
          googleAccountEmail: connection.googleAccountEmail,
        }
      : null,
    connectPath: "/connectors",
    tenantReady,
    userConnected,
  };
}
