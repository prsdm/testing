import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";

export const PPTX_LIBRARY_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Infer library content type from a filename extension. */
export function libraryContentTypeFromFileName(
  filename: string
): string | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "text/markdown";
  }
  if (lower.endsWith(".txt")) {
    return "text/plain";
  }
  if (lower.endsWith(".csv")) {
    return "text/csv";
  }
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".docx")) {
    return DOCX_DRIVE_MIME;
  }
  if (lower.endsWith(".xlsx")) {
    return XLSX_DRIVE_MIME;
  }
  if (lower.endsWith(".pptx")) {
    return PPTX_LIBRARY_MIME;
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  return null;
}

export function libraryDriveMimeType(args: {
  name: string;
  contentType: string;
}): string {
  const fromName = libraryContentTypeFromFileName(args.name);
  if (fromName) {
    return fromName;
  }
  const trimmed = args.contentType.trim();
  return trimmed || "application/octet-stream";
}
