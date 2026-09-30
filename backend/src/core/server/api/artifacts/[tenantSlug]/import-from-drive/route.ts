import { z } from "zod";
import { driveDownloadFileForArtifact } from "@/core/lib/connectors/providers/google-drive/read";
import {
  saveDocument,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { getDriveAccessForUser } from "@/core/lib/sources/drive-access";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

const bodySchema = z.object({
  fileId: z.string().min(1).max(256),
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

  const access = await getDriveAccessForUser({
    tenantId: authResult.tenant.id,
    tenantSlug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: 400 });
  }

  try {
    const downloaded = await driveDownloadFileForArtifact({
      accessToken: access.accessToken,
      fileId: body.fileId,
      tenantId: authResult.tenant.id,
    });

    const documentId = crypto.randomUUID();
    const userId = toTenantUserId(authResult.userId);

    const [saved] = await withTenantForUser(
      { email: authResult.userEmail, id: authResult.userId },
      () =>
        saveDocument({
          content: downloaded.content,
          driveFileId: downloaded.fileId,
          driveWebViewLink: downloaded.link,
          id: documentId,
          kind: downloaded.kind,
          title: downloaded.title,
          userId,
        })
    );

    return Response.json({
      createdAt: saved.createdAt,
      driveFileId: saved.driveFileId,
      driveWebViewLink: saved.driveWebViewLink,
      id: saved.id,
      kind: saved.kind,
      title: saved.title,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to open Drive file in Kimiro.";
    return Response.json({ error: message }, { status: 502 });
  }
}
