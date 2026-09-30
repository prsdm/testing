import { z } from "zod";
import { addDriveFilesToKnowledgeBase } from "@/core/lib/knowledge-bases/add-drive-to-knowledge-base";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { ChatbotError } from "@/shared/errors";

const bodySchema = z.object({
  fileIds: z.array(z.string().min(1).max(256)).min(1).max(10),
});

function toErrorResponse(error: unknown) {
  if (error instanceof ChatbotError) {
    return error.toResponse();
  }
  return Response.json({ error: "Request failed" }, { status: 500 });
}

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await addDriveFilesToKnowledgeBase({
      fileIds: parsed.data.fileIds,
      knowledgeBaseId,
      tenantId: authResult.tenant.id,
      tenantSlug,
      userEmail: authResult.userEmail,
      userId: authResult.userId,
    });

    if (!result.ok) {
      return Response.json(
        { error: result.error, results: result.results },
        { status: 400 }
      );
    }

    return Response.json({ results: result.results }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
