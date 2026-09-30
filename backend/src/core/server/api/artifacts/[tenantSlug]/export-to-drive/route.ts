import { z } from "zod";
import { driveUploadFile } from "@/core/lib/connectors/providers/google-drive/actions";
import { getDriveCreateAccessForUser } from "@/core/lib/sources/drive-access";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import { prepareArtifactDriveExport } from "@/shared/artifacts/prepare-drive-export";

const bodySchema = z.object({
  content: z.string(),
  folderId: z.string().optional(),
  kind: z.enum(["text", "sheet", "code"]),
  title: z.string().min(1).max(500),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.content.trim()) {
    return Response.json(
      { error: "Document is empty — nothing to export." },
      { status: 400 }
    );
  }

  const access = await getDriveCreateAccessForUser({
    tenantId: authResult.tenant.id,
    tenantSlug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: 400 });
  }

  try {
    const prepared = await prepareArtifactDriveExport({
      content: body.content,
      kind: body.kind,
      title: body.title,
    });

    const uploaded = await driveUploadFile({
      accessToken: access.accessToken,
      content: prepared.contentBase64,
      description: "Exported from Kimiro chat artifact",
      folderId: body.folderId,
      isBase64: true,
      mimeType: prepared.mimeType,
      name: prepared.name,
      tenantId: authResult.tenant.id,
    });

    return Response.json({
      id: uploaded.id,
      mimeType: uploaded.mimeType,
      name: uploaded.name,
      webContentLink: uploaded.webContentLink,
      webViewLink: uploaded.webViewLink,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to export document to Google Drive.";
    return Response.json({ error: message }, { status: 502 });
  }
}
