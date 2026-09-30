import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  deleteTenantMcpServer,
  getTenantMcpServerById,
  updateTenantMcpServer,
} from "@/core/lib/db/mcp-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const patchSchema = z.object({
  authMode: z.enum(["none", "bearer"]).optional(),
  authToken: z.string().optional(),
  availabilityMode: z.enum(["everyone", "selected"]).optional(),
  clearAuthToken: z.boolean().optional(),
  description: z.string().max(2000).nullable().optional(),
  isEnabled: z.boolean().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
  name: z.string().min(1).max(120).optional(),
  serverUrl: z.string().url().max(2048).optional(),
  transport: z.enum(["sse", "streamable_http"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serverId: string }> }
) {
  const { tenantSlug, serverId } = await params;
  const auth = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:mcp:${serverId}`,
    "admin.integrations"
  );
  if ("error" in auth) {
    return auth.error;
  }

  const server = await getTenantMcpServerById({
    serverId,
    tenantId: auth.tenant.id,
  });
  if (!server) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ server });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serverId: string }> }
) {
  const { tenantSlug, serverId } = await params;
  const auth = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:mcp:${serverId}`,
    "admin.integrations"
  );
  if ("error" in auth) {
    return auth.error;
  }

  const body = patchSchema.parse(await request.json());
  const server = await updateTenantMcpServer({
    authMode: body.authMode,
    authToken: body.authToken,
    availabilityMode: body.availabilityMode,
    clearAuthToken: body.clearAuthToken,
    description: body.description,
    isEnabled: body.isEnabled,
    memberIds: body.memberIds,
    name: body.name,
    serverId,
    serverUrl: body.serverUrl,
    tenantId: auth.tenant.id,
    transport: body.transport,
  });

  await insertSecurityAuditEvent({
    action: "tenant.admin.mcp_server.updated",
    email: auth.userEmail,
    ipAddress: auth.ipAddress,
    metadata: { serverId },
    resource: `admin:${tenantSlug}:mcp:${serverId}`,
    tenantId: auth.tenant.id,
    userId: auth.userId,
  });

  return Response.json({ server });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serverId: string }> }
) {
  const { tenantSlug, serverId } = await params;
  const auth = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:mcp:${serverId}`,
    "admin.integrations"
  );
  if ("error" in auth) {
    return auth.error;
  }

  await deleteTenantMcpServer({ serverId, tenantId: auth.tenant.id });

  await insertSecurityAuditEvent({
    action: "tenant.admin.mcp_server.deleted",
    email: auth.userEmail,
    ipAddress: auth.ipAddress,
    metadata: { serverId },
    resource: `admin:${tenantSlug}:mcp:${serverId}`,
    tenantId: auth.tenant.id,
    userId: auth.userId,
  });

  return Response.json({ ok: true });
}
