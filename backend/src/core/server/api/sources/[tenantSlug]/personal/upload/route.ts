import { createTeamKbItem } from "@/core/lib/db/source-queries";
import { extractKbUploadText } from "@/core/lib/sources/extract-upload-text";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
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

  const item = await createTeamKbItem({
    createdByUserId: authResult.userId,
    input: {
      content: extracted.content,
      sourceType: "upload",
      title: extracted.title,
    },
    tenantId: authResult.tenant.id,
  });

  return Response.json({ item }, { status: 201 });
}
