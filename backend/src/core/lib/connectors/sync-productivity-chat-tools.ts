import { confluenceToolIdsForConnector } from "@/core/lib/connectors/providers/confluence/chat-tools";
import { CONFLUENCE_PROVIDER_ID } from "@/core/lib/connectors/providers/confluence/provider";
import { notionToolIdsForConnector } from "@/core/lib/connectors/providers/notion/chat-tools";
import { NOTION_PROVIDER_ID } from "@/core/lib/connectors/providers/notion/provider";
import { sharePointToolIdsForConnector } from "@/core/lib/connectors/providers/sharepoint/chat-tools";
import { SHAREPOINT_PROVIDER_ID } from "@/core/lib/connectors/providers/sharepoint/provider";
import {
  getConfluenceConnectorForTenantUser,
  getNotionConnectorForTenantUser,
  getSharePointConnectorForTenantUser,
  syncMissingToolConfigsForConnector,
} from "@/core/lib/db/connector-queries";

/** Register newly shipped Notion/Confluence/SharePoint chat tools without reconnect. */
export async function syncProductivityChatToolsForUser(args: {
  tenantId: string;
  userId: string;
  notionEnabled?: boolean;
  confluenceEnabled?: boolean;
  sharePointEnabled?: boolean;
}) {
  const syncTasks: Promise<unknown>[] = [];

  if (args.notionEnabled) {
    syncTasks.push(
      (async () => {
        const connection = await getNotionConnectorForTenantUser(args);
        if (!connection) {
          return;
        }
        await syncMissingToolConfigsForConnector({
          connectorId: connection.connectorId,
          credentialId: connection.credentialId,
          tenantId: args.tenantId,
          tools: [
            {
              providerId: NOTION_PROVIDER_ID,
              toolIds: notionToolIdsForConnector(),
            },
          ],
          userId: args.userId,
        });
      })()
    );
  }

  if (args.confluenceEnabled) {
    syncTasks.push(
      (async () => {
        const connection = await getConfluenceConnectorForTenantUser(args);
        if (!connection) {
          return;
        }
        await syncMissingToolConfigsForConnector({
          connectorId: connection.connectorId,
          credentialId: connection.credentialId,
          tenantId: args.tenantId,
          tools: [
            {
              providerId: CONFLUENCE_PROVIDER_ID,
              toolIds: confluenceToolIdsForConnector(),
            },
          ],
          userId: args.userId,
        });
      })()
    );
  }

  if (args.sharePointEnabled) {
    syncTasks.push(
      (async () => {
        const connection = await getSharePointConnectorForTenantUser(args);
        if (!connection) {
          return;
        }
        await syncMissingToolConfigsForConnector({
          connectorId: connection.connectorId,
          credentialId: connection.credentialId,
          tenantId: args.tenantId,
          tools: [
            {
              providerId: SHAREPOINT_PROVIDER_ID,
              toolIds: sharePointToolIdsForConnector(),
            },
          ],
          userId: args.userId,
        });
      })()
    );
  }

  await Promise.all(syncTasks);
}
