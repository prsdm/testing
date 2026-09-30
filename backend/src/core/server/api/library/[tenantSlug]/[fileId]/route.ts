import { deleteLibraryFile } from "@/core/lib/db/library-queries";
import { toTenantUserId, withTenantId } from "@/core/lib/db/queries";
import { ApiResponse } from "@/core/lib/http/api-response";
import { getDeletableLibraryFile } from "@/core/lib/library/library-file-access";
import { deleteLibraryObject } from "@/core/lib/library/library-storage";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; fileId: string }> }
) {
  const { tenantSlug, fileId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const tenantUserId = toTenantUserId(authResult.userId);
    const deleted = await withTenantId(authResult.tenant.id, async () => {
      const file = await getDeletableLibraryFile({
        authUserId: authResult.userId,
        email: authResult.userEmail,
        fileId,
        tenantId: authResult.tenant.id,
        tenantUserId,
      });
      if (!file) {
        return null;
      }
      return deleteLibraryFile({
        fileId: file.id,
        tenantId: authResult.tenant.id,
        userId: file.userId,
      });
    });
    if (!deleted) {
      return ApiResponse.json({ error: "File not found" }, { status: 404 });
    }
    await deleteLibraryObject(deleted.pathname);
    return ApiResponse.json({ ok: true });
  } catch {
    return ApiResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
