import { buildKbCatalog } from "@/core/lib/sources/source-catalog";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const noStoreHeaders = {
    "cache-control": "no-store, max-age=0",
  };
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const catalog = await buildKbCatalog({
      tenantId: authResult.tenant.id,
      tenantSlug,
      userEmail: authResult.userEmail,
      userId: authResult.userId,
    });
    return Response.json(catalog, { headers: noStoreHeaders });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load knowledge catalog.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
