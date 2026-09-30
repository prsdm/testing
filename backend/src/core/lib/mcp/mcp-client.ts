import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { TenantMcpServer } from "@/core/lib/db/tables";

export type McpListedTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

function buildAuthHeaders(
  server: Pick<TenantMcpServer, "authMode" | "authToken">
) {
  const headers: Record<string, string> = {};
  if (server.authMode === "bearer" && server.authToken?.trim()) {
    headers.Authorization = `Bearer ${server.authToken.trim()}`;
  }
  return headers;
}

export async function withMcpClient<T>(
  server: Pick<
    TenantMcpServer,
    "serverUrl" | "transport" | "authMode" | "authToken"
  >,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  const url = new URL(server.serverUrl);
  const headers = buildAuthHeaders(server);
  const requestInit = { headers };

  const transport =
    server.transport === "streamable_http"
      ? new StreamableHTTPClientTransport(url, { requestInit })
      : new SSEClientTransport(url, { requestInit });

  const client = new Client({ name: "kimiro", version: "1.0.0" });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

export function listMcpToolsForServer(
  server: Pick<
    TenantMcpServer,
    "serverUrl" | "transport" | "authMode" | "authToken"
  >
): Promise<McpListedTool[]> {
  return withMcpClient(server, async (client) => {
    const result = await client.listTools();
    return result.tools.map((entry) => ({
      description: entry.description,
      inputSchema:
        entry.inputSchema &&
        typeof entry.inputSchema === "object" &&
        !Array.isArray(entry.inputSchema)
          ? (entry.inputSchema as Record<string, unknown>)
          : { type: "object", properties: {} },
      name: entry.name,
    }));
  });
}

export function callMcpToolForServer(
  server: Pick<
    TenantMcpServer,
    "serverUrl" | "transport" | "authMode" | "authToken"
  >,
  toolName: string,
  args: Record<string, unknown>
) {
  return withMcpClient(server, async (client) => {
    const result = await client.callTool({
      arguments: args,
      name: toolName,
    });
    return result;
  });
}
