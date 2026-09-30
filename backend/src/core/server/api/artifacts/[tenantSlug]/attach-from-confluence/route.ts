import { z } from "zod";
import { putChatUpload } from "@/core/lib/chat/chat-upload";
import { confluenceDownloadAttachmentForChat } from "@/core/lib/connectors/providers/confluence/attachments";
import { getConfluenceAccessForUser } from "@/core/lib/sources/confluence-access";
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

  const access = await getConfluenceAccessForUser({
    tenantId: authResult.tenant.id,
    userId: authResult.userId,
  });
  if (!access.ok) {
    return Response.json({ error: access.error }, { status: 400 });
  }

  try {
    const downloaded = await confluenceDownloadAttachmentForChat({
      accessToken: access.accessToken,
      cloudId: access.cloudId,
      fileId: body.fileId,
      tenantId: authResult.tenant.id,
    });

    const safeName = downloaded.title.replace(/[^a-zA-Z0-9._-]/g, "_");
    const copy = new Uint8Array(downloaded.bytes.byteLength);
    copy.set(downloaded.bytes);
    const uploaded = await putChatUpload({
      body: copy.buffer,
      contentType: downloaded.mimeType,
      safeName,
      userId: authResult.userId,
    });

    return Response.json({
      contentType: uploaded.contentType,
      name: downloaded.title,
      url: uploaded.url,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to attach Confluence file.";
    return Response.json({ error: message }, { status: 502 });
  }
}
