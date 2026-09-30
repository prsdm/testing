import { disconnectMcpServerForUser } from "@/core/lib/db/mcp-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; serverId: string }> }
) {
  const { tenantSlug, serverId } = await params;
  const auth = await assertTenantMember(tenantSlug, request);
  if ("error" in auth) {
    return auth.error;
  }

  await disconnectMcpServerForUser({
    authUserId: auth.userId,
    serverId,
    tenantId: auth.tenant.id,
  });

  return Response.json({ connected: false });
}
