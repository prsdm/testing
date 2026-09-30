import { notionBrowsePages } from "@/core/lib/connectors/providers/notion/read";
import { getNotionAccessForUser } from "@/core/lib/sources/notion-access";
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
  const cursor = url.searchParams.get("cursor") ?? undefined;

  const access = await getNotionAccessForUser({
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
    const result = await notionBrowsePages({
      accessToken: access.accessToken,
      limit: 20,
      query,
      startCursor: cursor,
    });
    const filteredPages = result.pages.filter((page) => {
      // Rows live under a data source; index the database instead of each row as a page.
      if (page.parentDataSourceId) {
        return false;
      }
      return true;
    });
    return Response.json(
      {
        ...result,
        pages: filteredPages,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to browse Notion pages.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
