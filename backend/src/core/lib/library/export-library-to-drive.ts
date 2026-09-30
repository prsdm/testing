import { driveUploadLibraryFile } from "@/core/lib/connectors/providers/google-drive/actions";
import { updateLibraryFileDriveLink } from "@/core/lib/db/library-queries";
import { toTenantUserId, withTenantId } from "@/core/lib/db/queries";
import { getReadableLibraryFile } from "@/core/lib/library/library-file-access";
import { readLibraryFileBytes } from "@/core/lib/library/library-storage";
import { getDriveCreateAccessForUser } from "@/core/lib/sources/drive-access";
import { libraryDriveMimeType } from "@/shared/library/content-type";
import {
  isLibraryCloudExportSupported,
  libraryGoogleAppsTargetMime,
} from "@/shared/library/library-preview-kind";

function cachedDriveExport(row: {
  driveFileId: string | null;
  driveWebViewLink: string | null;
  name: string;
  contentType: string;
}) {
  const webViewLink = row.driveWebViewLink?.trim();
  const driveFileId = row.driveFileId?.trim();
  if (!(webViewLink && driveFileId)) {
    return null;
  }

  return {
    id: driveFileId,
    mimeType: row.contentType,
    name: row.name,
    webContentLink: undefined,
    webViewLink,
  };
}

export async function exportLibraryFileToDrive(args: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  fileId: string;
}) {
  const tenantUserId = toTenantUserId(args.userId);
  const row = await withTenantId(args.tenantId, () =>
    getReadableLibraryFile({
      authUserId: args.userId,
      email: args.userEmail,
      fileId: args.fileId,
      tenantId: args.tenantId,
      tenantUserId,
    })
  );

  if (!row) {
    throw new Error("File not found.");
  }

  if (
    !isLibraryCloudExportSupported({
      contentType: row.contentType,
      name: row.name,
    })
  ) {
    throw new Error("This file type cannot be exported to Google Drive.");
  }

  const cached = cachedDriveExport(row);
  if (cached) {
    return cached;
  }

  const bytes = await readLibraryFileBytes(row.pathname);
  if (!bytes) {
    throw new Error("File not found.");
  }

  const access = await getDriveCreateAccessForUser({
    tenantId: args.tenantId,
    tenantSlug: args.tenantSlug,
    userEmail: args.userEmail,
    userId: args.userId,
  });
  if (!access.ok) {
    throw new Error(access.error);
  }

  const sourceMimeType = libraryDriveMimeType({
    contentType: row.contentType,
    name: row.name,
  });

  const uploaded = await driveUploadLibraryFile({
    accessToken: access.accessToken,
    content: bytes,
    description: "Opened from Kimiro library",
    name: row.name,
    sourceMimeType,
    targetGoogleAppsMime: libraryGoogleAppsTargetMime({
      contentType: row.contentType,
      name: row.name,
    }),
    tenantId: args.tenantId,
  });

  const webViewLink = uploaded.webViewLink?.trim();
  if (!(uploaded.id && webViewLink)) {
    throw new Error("Google Drive did not return an open link.");
  }

  await withTenantId(args.tenantId, () =>
    updateLibraryFileDriveLink({
      driveFileId: uploaded.id,
      driveWebViewLink: webViewLink,
      fileId: args.fileId,
      tenantId: args.tenantId,
      userId: tenantUserId,
    })
  );

  return {
    id: uploaded.id,
    mimeType: uploaded.mimeType,
    name: uploaded.name,
    webContentLink: uploaded.webContentLink,
    webViewLink,
  };
}
