import { buildArtifactFromLocalUpload } from "@/core/lib/artifacts/local-import";
import {
  saveDocument,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
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
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const imported = await buildArtifactFromLocalUpload({
      bytes,
      fileName: file.name,
      mimeType: file.type,
    });

    const documentId = crypto.randomUUID();
    const userId = toTenantUserId(authResult.userId);

    const [saved] = await withTenantForUser(
      { email: authResult.userEmail, id: authResult.userId },
      () =>
        saveDocument({
          content: imported.content,
          driveFileId: null,
          driveWebViewLink: null,
          id: documentId,
          kind: imported.kind,
          title: imported.title,
          userId,
        })
    );

    return Response.json({
      createdAt: saved.createdAt,
      id: saved.id,
      kind: saved.kind,
      title: saved.title,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to open file in the editor.";
    const status = message.includes("Only .docx") ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}
