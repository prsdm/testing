import { assertTenantCapabilityRequest } from "@/core/lib/admin/assert-tenant-admin-request";

export async function assertIntegrationAdmin(
  tenantSlug: string,
  request: Request,
  resourceSuffix?: string
) {
  return await assertTenantCapabilityRequest(
    tenantSlug,
    request,
    `integrations:${tenantSlug}${resourceSuffix ? `:${resourceSuffix}` : ""}`,
    "admin.integrations"
  );
}
