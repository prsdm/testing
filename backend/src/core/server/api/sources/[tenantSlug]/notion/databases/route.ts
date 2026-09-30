import { notionBrowseDatabases } from "@/core/lib/connectors/providers/notion/browse-databases";
import { getNotionAccessForUser } from "@/core/lib/sources/notion-access";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

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
    const result = await notionBrowseDatabases({
      accessToken: access.accessToken,
      limit: 20,
      query,
      startCursor: cursor,
    });
    const filteredDatabases = result.databases.filter(
      (database) => normalizeTitle(database.title) !== "people"
    );
    return Response.json(
      {
        ...result,
        databases: filteredDatabases,
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to browse Notion databases.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
