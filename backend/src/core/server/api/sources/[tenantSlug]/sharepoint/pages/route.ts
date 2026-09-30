import { sharePointBrowsePages } from "@/core/lib/connectors/providers/sharepoint/read";
import { toSharePointPageRef } from "@/core/lib/sources/index-sharepoint-pages";
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
    const result = await sharePointBrowsePages({
      accessToken: access.accessToken,
      limit: 20,
      query,
    });
    return Response.json(
      {
        pages: result.pages.map((page) => ({
          link: page.link,
          modifiedTime: page.modifiedTime,
          pageRef: toSharePointPageRef(page),
          title: page.title,
        })),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to browse SharePoint pages.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
