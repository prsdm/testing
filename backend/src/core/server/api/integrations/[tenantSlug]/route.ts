import { getTenantIndexStatus } from "@/core/lib/db/search-index-queries";
import { assertTenantAdmin } from "@/core/lib/sources/tenant-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authz = await assertTenantAdmin(tenantSlug, request);
  if ("error" in authz) {
    return authz.error;
  }
  const { tenant } = authz;

  const status = await getTenantIndexStatus(tenant.id);
  return Response.json(status);
}
