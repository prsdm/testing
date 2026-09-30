import { assertIntegrationAdmin } from "@/core/lib/integrations/assert-integration-admin";
import { getTenantIntegrationsAdminView } from "@/core/lib/integrations/integration-admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertIntegrationAdmin(
    tenantSlug,
    request,
    "catalog"
  );
  if ("error" in authResult) {
    return authResult.error;
  }

  const integrations = await getTenantIntegrationsAdminView(
    authResult.tenant.id
  );
  return Response.json({ integrations });
}
