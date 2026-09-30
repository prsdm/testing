import { confluenceBrowseSpaces } from "@/core/lib/connectors/providers/confluence/read";
import { getConfluenceAccessForUser } from "@/core/lib/sources/confluence-access";
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

  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const access = await getConfluenceAccessForUser({
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });
  if (!access.ok) {
    return Response.json(
      { error: access.error },
      { headers: noStoreHeaders, status: 400 }
    );
  }

  try {
    const result = await confluenceBrowseSpaces({
      accessToken: access.accessToken,
      cloudId: access.cloudId,
      cursor,
      limit: 50,
    });
    return Response.json(result, { headers: noStoreHeaders });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to browse Confluence spaces.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
