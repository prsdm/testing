import { driveBrowseFiles } from "@/core/lib/connectors/providers/google-drive/read";
import { getDriveAccessForUser } from "@/core/lib/sources/drive-access";
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
  const query = url.searchParams.get("q") ?? undefined;
  const pageToken = url.searchParams.get("pageToken") ?? undefined;

  const access = await getDriveAccessForUser({
    tenantId: authResult.tenant.id,
    tenantSlug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });
  if (!access.ok) {
    return Response.json(
      { error: access.error },
      { headers: noStoreHeaders, status: 400 }
    );
  }

  try {
    const result = await driveBrowseFiles({
      accessToken: access.accessToken,
      pageToken,
      query,
      tenantId: authResult.tenant.id,
    });
    return Response.json(result, { headers: noStoreHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to browse Drive files.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
