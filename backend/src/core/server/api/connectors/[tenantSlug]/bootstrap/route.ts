import { loadConnectorsPageBootstrap } from "@/core/lib/connectors/connectors-page-bootstrap";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const bootstrap = await loadConnectorsPageBootstrap(
    tenantSlug,
    authResult.userId
  );
  if ("error" in bootstrap) {
    return Response.json(
      { error: bootstrap.error },
      { status: bootstrap.status }
    );
  }

  return Response.json(bootstrap);
}
