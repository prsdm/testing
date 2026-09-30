import { addUploadToKnowledgeBase } from "@/core/lib/knowledge-bases/knowledge-base-queries";
import { extractKbUploadText } from "@/core/lib/sources/extract-upload-text";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart form data" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file field" }, { status: 400 });
  }

  const extracted = await extractKbUploadText(file);
  if (!extracted.ok) {
    return Response.json({ error: extracted.error }, { status: 400 });
  }

  try {
    const linked = await addUploadToKnowledgeBase({
      content: extracted.content,
      fileName: file.name,
      knowledgeBaseId,
      tenantId: authResult.tenant.id,
      title: extracted.title,
      userEmail: authResult.userEmail,
      userId: authResult.userId,
    });

    return Response.json({ source: linked }, { status: 201 });
  } catch (error) {
    console.error("[knowledge-base upload]", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    const embeddingUnavailable = /fetch failed|ECONNREFUSED|Model server/i.test(
      message
    );
    if (embeddingUnavailable) {
      return Response.json(
        {
          error:
            "Could not index this file: embedding service is not reachable. With EMBEDDING_PROVIDER=tei, run `docker compose up -d model_server indexing_model_server`, or switch to OpenAI embeddings in .env.",
        },
        { status: 503 }
      );
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
