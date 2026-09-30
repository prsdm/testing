export type DriveFileSummary = {
  fileId: string;
  title: string;
  mimeType: string;
  link: string;
  modifiedTime?: string;
  driveId?: string;
};

export type DriveGetFileResult = {
  fileId: string;
  title: string;
  mimeType: string;
  link: string;
  modifiedTime?: string;
  content: string;
  truncated: boolean;
};

export type DriveToolErrorOutput = {
  error: string;
  code?: string;
  connectUrl?: string;
};
