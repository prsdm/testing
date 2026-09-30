import type { LibraryPreviewKind } from "@/shared/library/library-preview-kind";

export type LibraryPreviewApiResponse = {
  fileId: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  kind: LibraryPreviewKind;
  title: string;
  driveWebViewLink?: string;
  content?: string;
  error?: string;
};
