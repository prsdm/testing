export const GOOGLE_FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveResourceType =
  | "folder"
  | "shared_drive"
  | "google_doc"
  | "google_sheet"
  | "google_slides"
  | "file";

export function driveResourceType(input: {
  mimeType?: string | null;
  kind?: string | null;
}): DriveResourceType {
  if (input.kind === "drive#drive") {
    return "shared_drive";
  }
  const mimeType = input.mimeType ?? "";
  if (mimeType === GOOGLE_FOLDER_MIME) {
    return "folder";
  }
  if (mimeType === "application/vnd.google-apps.document") {
    return "google_doc";
  }
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    return "google_sheet";
  }
  if (mimeType === "application/vnd.google-apps.presentation") {
    return "google_slides";
  }
  return "file";
}

export function enrichDriveRecord<T extends Record<string, unknown>>(
  record: T
): T & { resourceType: DriveResourceType; mimeType?: string } {
  const mimeType =
    typeof record.mimeType === "string" ? record.mimeType : undefined;
  const kind = typeof record.kind === "string" ? record.kind : undefined;
  return {
    ...record,
    ...(mimeType ? { mimeType } : {}),
    resourceType: driveResourceType({ kind, mimeType }),
  };
}
