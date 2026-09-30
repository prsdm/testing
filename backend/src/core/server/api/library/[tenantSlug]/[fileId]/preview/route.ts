import { toTenantUserId, withTenantId } from "@/core/lib/db/queries";
import { ApiResponse } from "@/core/lib/http/api-response";
import { buildLibraryPreviewPayload } from "@/core/lib/library/build-library-preview";
import { getReadableLibraryFile } from "@/core/lib/library/library-file-access";
import {
  readLibraryFileBytes,
  toLibraryFileResponse,
} from "@/core/lib/library/library-storage";
import { assertTenantMember } from "@/core/lib/sources/tenant-auth";
import type { LibraryPreviewApiResponse } from "@/shared/library/library-preview-api";
import { libraryPreviewKindFromMeta } from "@/shared/library/library-preview-kind";

export type { LibraryPreviewApiResponse } from "@/shared/library/library-preview-api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tenantSlug: string; fileId: string }> }
) {
  const { tenantSlug, fileId } = await params;
  const authResult = await assertTenantMember(tenantSlug, request);
  if ("error" in authResult) {
    return authResult.error;
  }

  const tenantUserId = toTenantUserId(authResult.userId);
  const row = await withTenantId(authResult.tenant.id, () =>
    getReadableLibraryFile({
      authUserId: authResult.userId,
      email: authResult.userEmail,
      fileId,
      tenantId: authResult.tenant.id,
      tenantUserId,
    })
  );

  if (!row) {
    return ApiResponse.json({ error: "File not found" }, { status: 404 });
  }

  const file = toLibraryFileResponse(row);
  const driveWebViewLink = row.driveWebViewLink?.trim() || undefined;
  const kind = libraryPreviewKindFromMeta({
    contentType: file.contentType,
    name: file.name,
  });

  if (kind === "unsupported") {
    const payload: LibraryPreviewApiResponse = {
      contentType: file.contentType,
      downloadUrl: file.url,
      driveWebViewLink,
      fileId: file.id,
      kind,
      name: file.name,
      sizeBytes: file.sizeBytes,
      title: file.name,
    };
    return ApiResponse.json(payload);
  }

  if (
    kind === "slides" ||
    kind === "text" ||
    kind === "sheet" ||
    kind === "pdf"
  ) {
    const payload: LibraryPreviewApiResponse = {
      contentType: file.contentType,
      downloadUrl: file.url,
      driveWebViewLink,
      fileId: file.id,
      kind,
      name: file.name,
      sizeBytes: file.sizeBytes,
      title: file.name,
    };
    return ApiResponse.json(payload);
  }

  const bytes = await readLibraryFileBytes(file.pathname);
  if (!bytes) {
    return ApiResponse.json({ error: "File not found" }, { status: 404 });
  }

  const preview = await buildLibraryPreviewPayload({
    bytes,
    contentType: file.contentType,
    name: file.name,
  });

  const payload: LibraryPreviewApiResponse = {
    contentType: file.contentType,
    downloadUrl: file.url,
    driveWebViewLink,
    fileId: file.id,
    kind: preview.kind,
    name: file.name,
    sizeBytes: file.sizeBytes,
    title: preview.title,
    ...(preview.kind === "sheet" ? { content: preview.content } : {}),
  };

  return ApiResponse.json(payload);
}
