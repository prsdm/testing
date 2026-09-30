import { getDriveIndexEligibility } from "@/core/lib/integrations/drive-index-eligibility";
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

  const eligibility = await getDriveIndexEligibility({
    primaryDomain: tenant.primaryDomain,
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
  });

  return Response.json({
    canIndex: eligibility.canIndex,
    driveReady: eligibility.driveReady,
    envAllowsIndexing: eligibility.envAllowsIndexing,
    indexingEnabled: eligibility.indexingEnabled,
    reason: eligibility.reason,
  });
}
