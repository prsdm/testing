import { type ToolSet, tool } from "ai";
import { executeIdempotentTool } from "@/core/lib/ai/execute-idempotent-tool";
import {
  buildZodSchemaForTool,
  toolDescription,
} from "@/core/lib/connectors/providers/zod";
import {
  getConnectorsByIdsForTenantUser,
  getCredentialRowsByIdsForTenant,
  isPersonalConnectorProvider,
  listAccessibleToolConfigsByIdsForTenantUser,
} from "@/core/lib/db/connector-queries";
import { isWriteToolName } from "@/shared/ai/tool-approvals";
import type { LatentChatIntegration } from "./chat-integration-availability";
import { getLatentChatIntegrationState } from "./chat-integration-availability";
import { executeConnectorTool } from "./execute-connector-tool";

export type ConnectionToolNameMap = Map<
  string,
  {
    toolConfigId: string;
    toolId: string;
    providerId: string;
    connectorId: string;
  }
>;

/** Build AI SDK chat tools for selected tool config IDs. */
export async function buildConnectorToolsForChat(args: {
  tenantId: string;
  userId: string;
  tenantSlug: string;
  toolConfigIds: string[];
  toolParamOverridesByConfigId?: Record<string, Record<string, unknown>>;
  workflowRunId?: string;
}): Promise<{
  tools: ToolSet;
  activeToolNames: string[];
  nameMap: ConnectionToolNameMap;
  latentIntegrations: LatentChatIntegration[];
}> {
  const [{ latentIntegrations, blockedToolIds }, toolConfigRows] =
    await Promise.all([
      getLatentChatIntegrationState({
        tenantId: args.tenantId,
        tenantSlug: args.tenantSlug,
        userId: args.userId,
      }),
      listAccessibleToolConfigsByIdsForTenantUser({
        ids: args.toolConfigIds,
        tenantId: args.tenantId,
        userId: args.userId,
      }),
    ]);

  const credentialRequireOwned = new Map<string, boolean>();
  for (const row of toolConfigRows) {
    if (!row.credentialId) {
      continue;
    }
    credentialRequireOwned.set(
      row.credentialId,
      isPersonalConnectorProvider(row.providerId)
    );
  }

  const [credentialById, connectionById] = await Promise.all([
    getCredentialRowsByIdsForTenant({
      credentialIds: [...credentialRequireOwned.keys()],
      requireOwnedByCredentialId: credentialRequireOwned,
      tenantId: args.tenantId,
      userId: args.userId,
    }),
    getConnectorsByIdsForTenantUser({
      connectorIds: [
        ...new Set(
          toolConfigRows
            .map((row) => row.connectorId)
            .filter((connectorId): connectorId is string =>
              Boolean(connectorId)
            )
        ),
      ],
      tenantId: args.tenantId,
      userId: args.userId,
    }),
  ]);

  const entries: {
    toolConfigId: string;
    toolId: string;
    providerId: string;
    connectorId: string;
  }[] = [];
  const seenProviderToolKind = new Set<string>();

  for (const row of toolConfigRows) {
    if (!row.credentialId) {
      continue;
    }
    if (blockedToolIds.has(row.toolId)) {
      continue;
    }
    const cred = credentialById.get(row.credentialId);
    if (!cred?.enabled) {
      continue;
    }
    if (row.connectorId) {
      const integ = connectionById.get(row.connectorId);
      if (integ?.status !== "active") {
        continue;
      }
    }
    const kind = `${row.providerId}:${row.toolId}`;
    if (seenProviderToolKind.has(kind)) {
      continue;
    }
    seenProviderToolKind.add(kind);

    const integId = row.connectorId ?? row.tenantId;
    entries.push({
      connectorId: integId,
      providerId: row.providerId,
      toolConfigId: row.id,
      toolId: row.toolId,
    });
  }

  const byToolId = new Map<string, Set<string>>();
  for (const e of entries) {
    let s = byToolId.get(e.toolId);
    if (!s) {
      s = new Set();
      byToolId.set(e.toolId, s);
    }
    s.add(e.connectorId);
  }
  const needsNamespace = (tid: string) => (byToolId.get(tid)?.size ?? 0) > 1;

  const tools: ToolSet = {};
  const activeToolNames: string[] = [];
  const nameMap: ConnectionToolNameMap = new Map();

  for (const e of entries) {
    const name = needsNamespace(e.toolId)
      ? `${e.connectorId}__${e.toolId}`
      : e.toolId;

    const schema = buildZodSchemaForTool(e.providerId, e.toolId);
    const description = toolDescription(e.providerId, e.toolId);

    tools[name] = tool({
      description,
      execute: async (input, options) => {
        const execute = () =>
          executeConnectorTool({
            input: input as Record<string, unknown>,
            providerId: e.providerId,
            tenantId: args.tenantId,
            toolConfigId: e.toolConfigId,
            toolId: e.toolId,
            toolInputOverrides:
              args.toolParamOverridesByConfigId?.[e.toolConfigId] ?? {},
            userId: args.userId,
          });

        if (isWriteToolName(name) && args.workflowRunId) {
          return await executeIdempotentTool({
            execute,
            input,
            tenantId: args.tenantId,
            toolCallId: options.toolCallId,
            toolName: name,
            workflowRunId: args.workflowRunId,
          });
        }

        return await execute();
      },
      inputSchema: schema,
    });

    activeToolNames.push(name);
    nameMap.set(name, {
      connectorId: e.connectorId,
      providerId: e.providerId,
      toolConfigId: e.toolConfigId,
      toolId: e.toolId,
    });
  }

  // Latent integrations are for the connection gate / Connect CTA only.
  // Do not register stub tools on the model — that burns an LLM turn on
  // "please connect" prose when the user isn't connected yet.
  return { activeToolNames, latentIntegrations, nameMap, tools };
}
