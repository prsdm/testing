"use client";

import type { DriveExportKind } from "@/shared/artifacts/prepare-drive-export";

export type ExportArtifactToDriveResult = {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
};

/** Upload the open artifact to the user's Google Drive. */
export async function exportArtifactToDrive(args: {
  tenantSlug: string;
  kind: DriveExportKind;
  title: string;
  content: string;
}): Promise<ExportArtifactToDriveResult> {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const response = await fetch(
    `${basePath}/api/artifacts/${args.tenantSlug}/export-to-drive`,
    {
      body: JSON.stringify({
        content: args.content,
        kind: args.kind,
        title: args.title,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }
  );

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    webContentLink?: string;
  } | null;

  if (!response.ok) {
    throw new Error(
      payload?.error?.trim() || "Failed to export to Google Drive."
    );
  }

  if (!(payload?.id && payload.name)) {
    throw new Error("Drive export returned an incomplete response.");
  }

  return {
    id: payload.id,
    mimeType: payload.mimeType,
    name: payload.name,
    webContentLink: payload.webContentLink,
    webViewLink: payload.webViewLink,
  };
}
