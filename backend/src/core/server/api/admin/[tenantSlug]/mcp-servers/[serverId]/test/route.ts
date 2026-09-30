import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import { getTenantMcpServerSecretsById } from "@/core/lib/db/mcp-queries";
import { listMcpServerToolsPayload } from "@/core/lib/mcp/list-mcp-server-tools-payload";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serverId: string }> }
) {
  const { tenantSlug, serverId } = await params;
  const auth = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:mcp:${serverId}:test`,
    "admin.integrations"
  );
  if ("error" in auth) {
    return auth.error;
  }

  const server = await getTenantMcpServerSecretsById({
    serverId,
    tenantId: auth.tenant.id,
  });
  if (!server) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const payload = await listMcpServerToolsPayload(server);
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reach MCP server",
        ok: false,
      },
      { status: 502 }
    );
  }
}
