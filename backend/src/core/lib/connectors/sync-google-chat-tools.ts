import {
  getGoogleAppConnectorForTenantUser,
  migrateLegacyUnifiedGoogleConnectorIfNeeded,
} from "@/core/lib/connectors/providers/google-shared/queries";
import { syncMissingToolConfigsForConnector } from "@/core/lib/db/connector-queries";
import { GOOGLE_WORKSPACE_APPS } from "@/shared/connectors/providers/google-shared/apps";

/** Register newly shipped Google chat tools per connected app without forcing reconnect. */
export async function syncGoogleAppChatToolsForUser(args: {
  tenantId: string;
  userId: string;
}) {
  await migrateLegacyUnifiedGoogleConnectorIfNeeded(args);

  for (const app of GOOGLE_WORKSPACE_APPS) {
    const connection = await getGoogleAppConnectorForTenantUser({
      appId: app.id,
      tenantId: args.tenantId,
      userId: args.userId,
    });
    if (!connection) {
      continue;
    }

    await syncMissingToolConfigsForConnector({
      connectorId: connection.connectorId,
      credentialId: connection.credentialId,
      tenantId: args.tenantId,
      tools: [
        {
          providerId: app.providerId,
          toolIds: app.toolIds(),
        },
      ],
      userId: args.userId,
    });
  }
}

/** @deprecated Use syncGoogleAppChatToolsForUser */
export async function syncGoogleUnifiedChatToolsForUser(args: {
  tenantId: string;
  userId: string;
}) {
  return await syncGoogleAppChatToolsForUser(args);
}
