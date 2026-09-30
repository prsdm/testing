"use client";

import type { LibraryCloudExportStatusResponse } from "@/shared/library/cloud-export-types";

export type ExportLibraryFileToDriveResult = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
};

export async function fetchLibraryCloudExportStatus(args: {
  tenantSlug: string;
  returnTo?: string;
}): Promise<LibraryCloudExportStatusResponse> {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const query = args.returnTo
    ? `?returnTo=${encodeURIComponent(args.returnTo)}`
    : "";
  const response = await fetch(
    `${basePath}/api/library/${args.tenantSlug}/cloud-export-status${query}`
  );
  const payload = (await response.json().catch(() => null)) as
    | (LibraryCloudExportStatusResponse & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.trim() || "Failed to load cloud export options."
    );
  }

  if (typeof payload?.connected !== "boolean") {
    throw new Error("Cloud export options returned an incomplete response.");
  }

  return payload;
}

export async function exportLibraryFileToDrive(args: {
  tenantSlug: string;
  fileId: string;
}): Promise<ExportLibraryFileToDriveResult> {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const response = await fetch(
    `${basePath}/api/library/${args.tenantSlug}/${args.fileId}/export-to-drive`,
    { method: "POST" }
  );

  const payload = (await response.json().catch(() => null)) as
    | (ExportLibraryFileToDriveResult & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.trim() || "Failed to open file in Google Drive."
    );
  }

  if (!(payload?.id && payload.name)) {
    throw new Error("Drive export returned an incomplete response.");
  }

  return payload;
}
