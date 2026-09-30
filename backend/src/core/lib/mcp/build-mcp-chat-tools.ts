import type { ToolSet } from "ai";
import type { McpWorkflowToolDescriptor } from "@/core/lib/ai/chat-workflow-types";
import { listConnectedMcpServersForChat } from "@/core/lib/db/mcp-queries";
import { listMcpToolsForServer } from "@/core/lib/mcp/mcp-client";
import { mcpExecutableToolName } from "@/core/lib/mcp/mcp-slug";

export async function buildMcpToolsForChat(args: {
  tenantId: string;
  authUserId: string;
}): Promise<{
  descriptors: McpWorkflowToolDescriptor[];
  tools: ToolSet;
  activeToolNames: string[];
}> {
  const servers = await listConnectedMcpServersForChat(args);
  const descriptors: McpWorkflowToolDescriptor[] = [];

  for (const server of servers) {
    let listed: Awaited<ReturnType<typeof listMcpToolsForServer>>;
    try {
      listed = await listMcpToolsForServer(server);
    } catch {
      continue;
    }

    for (const mcpTool of listed) {
      descriptors.push({
        description:
          mcpTool.description?.trim() ||
          `Run MCP tool “${mcpTool.name}” from ${server.name}.`,
        inputSchema: mcpTool.inputSchema,
        mcpToolName: mcpTool.name,
        name: mcpExecutableToolName(server.slug, mcpTool.name),
        serverId: server.id,
      });
    }
  }

  return {
    activeToolNames: descriptors.map((entry) => entry.name),
    descriptors,
    tools: {},
  };
}
