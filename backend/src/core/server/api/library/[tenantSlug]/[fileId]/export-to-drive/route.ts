import { exportLibraryFileToDrive } from "@/core/lib/library/export-library-to-drive";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; fileId: string }> }
) {
  const { tenantSlug, fileId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const uploaded = await exportLibraryFileToDrive({
      fileId,
      tenantId: authResult.tenant.id,
      tenantSlug,
      userEmail: authResult.userEmail,
      userId: authResult.userId,
    });

    return Response.json(uploaded);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to export file to Google Drive.";
    return Response.json({ error: message }, { status: 502 });
  }
}
