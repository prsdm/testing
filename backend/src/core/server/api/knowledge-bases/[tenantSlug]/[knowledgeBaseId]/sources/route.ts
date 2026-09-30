import { removeSourceFromKnowledgeBase } from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";

function toErrorResponse(error: unknown) {
  if (error instanceof ChatbotError) {
    return error.toResponse();
  }
  return Response.json({ error: "Request failed" }, { status: 500 });
}

export async function DELETE(
  request: Request,
  {
    params,
  }: { params: Promise<{ tenantSlug: string; knowledgeBaseId: string }> }
) {
  const { tenantSlug, knowledgeBaseId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const sourceItemId = new URL(request.url).searchParams
    .get("sourceItemId")
    ?.trim();
  if (!sourceItemId) {
    return Response.json({ error: "Missing sourceItemId" }, { status: 400 });
  }

  try {
    await removeSourceFromKnowledgeBase({
      knowledgeBaseId,
      sourceItemId,
      tenantId: authResult.tenant.id,
      userId: authResult.userId,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
