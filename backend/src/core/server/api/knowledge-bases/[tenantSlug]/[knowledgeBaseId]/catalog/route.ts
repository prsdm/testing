import { buildKnowledgeBaseCatalog } from "@/core/lib/knowledge-bases/knowledge-base-catalog";
import { getKnowledgeBaseForUser } from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; knowledgeBaseId: string }> }
) {
  const noStoreHeaders = {
    "cache-control": "no-store, max-age=0",
  };
  const { tenantSlug, knowledgeBaseId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const knowledgeBase = await getKnowledgeBaseForUser({
    knowledgeBaseId,
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });
  if (!knowledgeBase) {
    return Response.json(
      { error: "Knowledge base not found" },
      { headers: noStoreHeaders, status: 404 }
    );
  }

  try {
    const catalog = await buildKnowledgeBaseCatalog({ knowledgeBaseId });
    return Response.json(catalog, { headers: noStoreHeaders });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load knowledge base catalog.";
    return Response.json(
      { error: message },
      { headers: noStoreHeaders, status: 502 }
    );
  }
}
