import { z } from "zod";
import { pinGoogleDriveFileToKb } from "@/core/lib/sources/pin-drive-doc";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

const bodySchema = z.object({
  fileId: z.string().min(1).max(128),
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

  const result = await pinGoogleDriveFileToKb({
    fileId: body.fileId,
    tenantId: authResult.tenant.id,
    tenantSlug,
    userEmail: authResult.userEmail,
    userId: authResult.userId,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ item: result.item }, { status: 201 });
}
