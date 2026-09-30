import { z } from "zod";
import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";
import {
  createTenantMcpServer,
  listTenantMcpServersForAdmin,
} from "@/core/lib/db/mcp-queries";
import { insertSecurityAuditEvent } from "@/core/lib/db/queries";

const postSchema = z.object({
  authMode: z.enum(["none", "bearer"]).optional(),
  authToken: z.string().optional(),
  availabilityMode: z.enum(["everyone", "selected"]).optional(),
  description: z.string().max(2000).optional(),
  isEnabled: z.boolean().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
  name: z.string().min(1).max(120),
  serverUrl: z.string().url().max(2048),
  transport: z.enum(["sse", "streamable_http"]).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const auth = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:mcp-servers`,
    "admin.integrations"
  );
  if ("error" in auth) {
    return auth.error;
  }

  const servers = await listTenantMcpServersForAdmin(auth.tenant.id);
  return Response.json({ servers });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const auth = await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `admin:${tenantSlug}:mcp-servers`,
    "admin.integrations"
  );
  if ("error" in auth) {
    return auth.error;
  }

  const body = postSchema.parse(await request.json());
  const server = await createTenantMcpServer({
    authMode: body.authMode ?? "none",
    authToken: body.authToken,
    availabilityMode: body.availabilityMode,
    description: body.description,
    isEnabled: body.isEnabled,
    memberIds: body.memberIds,
    name: body.name,
    serverUrl: body.serverUrl,
    tenantId: auth.tenant.id,
    transport: body.transport ?? "sse",
  });

  await insertSecurityAuditEvent({
    action: "tenant.admin.mcp_server.created",
    email: auth.userEmail,
    ipAddress: auth.ipAddress,
    metadata: { serverId: server?.id, slug: server?.slug },
    resource: `admin:${tenantSlug}:mcp:${server?.id}`,
    tenantId: auth.tenant.id,
    userId: auth.userId,
  });

  return Response.json({ server });
}
