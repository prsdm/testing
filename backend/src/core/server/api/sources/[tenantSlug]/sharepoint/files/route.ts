import { sharePointBrowseAttachableFiles } from "@/core/lib/connectors/providers/sharepoint/files";
import { getSharePointAccessForUser } from "@/core/lib/sources/sharepoint-access";
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
  const fromParam = url.searchParams.get("from");
  const from = fromParam ? Number.parseInt(fromParam, 10) : 0;

  const access = await getSharePointAccessForUser({
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
    const result = await sharePointBrowseAttachableFiles({
      accessToken: access.accessToken,
      from: Number.isFinite(from) ? from : 0,
      query,
      tenantId: authResult.tenant.id,
    });
    return Response.json(
      {
        files: result.files,
        nextPageToken:
          result.nextFrom === undefined ? undefined : String(result.nextFrom),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to browse SharePoint files.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
