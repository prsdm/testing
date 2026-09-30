import { z } from "zod";
import { searchKnowledgeBase } from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

const searchSchema = z.object({
  limit: z.number().int().min(1).max(24).optional(),
  query: z.string().trim().min(1).max(500),
});

export async function POST(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid search payload" }, { status: 400 });
  }

  const results = await searchKnowledgeBase({
    knowledgeBaseId,
    limit: parsed.data.limit,
    query: parsed.data.query,
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });

  return Response.json({ results });
}
