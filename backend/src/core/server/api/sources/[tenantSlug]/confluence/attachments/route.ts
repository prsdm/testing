import { confluenceBrowseAttachableAttachments } from "@/core/lib/connectors/providers/confluence/attachments";
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
  const query = url.searchParams.get("q") ?? undefined;
  const startParam = url.searchParams.get("start");
  const start = startParam ? Number.parseInt(startParam, 10) : 0;

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
    const result = await confluenceBrowseAttachableAttachments({
      accessToken: access.accessToken,
      cloudId: access.cloudId,
      query,
      start: Number.isFinite(start) ? start : 0,
      tenantId: authResult.tenant.id,
    });
    return Response.json(
      {
        files: result.files,
        nextPageToken:
          result.nextStart === undefined ? undefined : String(result.nextStart),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to browse Confluence attachments.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
