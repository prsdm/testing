/** Google Drive chat tools (reads + writes). */
export const GOOGLE_DRIVE_READ_TOOL_IDS = [
  "driveListFolders",
  "driveSearchFiles",
  "driveGetFile",
] as const;

export const GOOGLE_DRIVE_WRITE_TOOL_IDS = [
  "driveCreateFolder",
  "driveCreateSharedDrive",
  "driveUploadFile",
  "driveMoveFile",
  "driveUpdateFile",
] as const;

export const GOOGLE_DRIVE_ACTION_TOOL_IDS = [
  ...GOOGLE_DRIVE_READ_TOOL_IDS,
  ...GOOGLE_DRIVE_WRITE_TOOL_IDS,
] as const;

export const GOOGLE_DRIVE_ALL_TOOL_IDS = [
  ...GOOGLE_DRIVE_ACTION_TOOL_IDS,
] as const;

export type GoogleDriveToolId = (typeof GOOGLE_DRIVE_ALL_TOOL_IDS)[number];

export function isGoogleDriveToolId(
  toolId: string
): toolId is GoogleDriveToolId {
  return (GOOGLE_DRIVE_ALL_TOOL_IDS as readonly string[]).includes(toolId);
}

export function googleDriveToolIdsForConnector(): string[] {
  return [...GOOGLE_DRIVE_ACTION_TOOL_IDS];
}
