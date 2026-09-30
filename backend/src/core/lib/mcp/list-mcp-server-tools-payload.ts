import type { TenantMcpServer } from "@/core/lib/db/tables";
import { listMcpToolsForServer } from "@/core/lib/mcp/mcp-client";

export type McpServerToolSummary = {
  name: string;
  description: string;
};

export async function listMcpServerToolsPayload(
  server: Pick<
    TenantMcpServer,
    "serverUrl" | "transport" | "authMode" | "authToken"
  >
) {
  const tools = await listMcpToolsForServer(server);
  const summaries: McpServerToolSummary[] = tools.map((tool) => ({
    description: tool.description?.trim() ?? "",
    name: tool.name,
  }));
  return {
    ok: true as const,
    toolCount: summaries.length,
    tools: summaries,
  };
}
