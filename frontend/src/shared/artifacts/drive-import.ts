import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";
import { XLSX_CONTENT_PREFIX } from "@/shared/artifacts/sheet-xlsx";
import { DOCX_CONTENT_PREFIX } from "@/shared/artifacts/text-docx";
import { PPTX_LIBRARY_MIME } from "@/shared/library/content-type";

export const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
export const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";

/** Max raw file bytes we will import into a chat artifact. */
export const MAX_DRIVE_IMPORT_BYTES = 15 * 1024 * 1024;

export type DriveImportKind = "text" | "sheet";

export type DriveImportPlan = {
  kind: DriveImportKind;
  /** Drive export mime, or null when downloading native Office bytes via alt=media. */
  exportMimeType: string | null;
  storagePrefix: typeof DOCX_CONTENT_PREFIX | typeof XLSX_CONTENT_PREFIX;
};

/** Map a Drive mime type to an artifact import plan, or null if unsupported. */
export function resolveDriveImportPlan(
  mimeType: string
): DriveImportPlan | null {
  if (mimeType === GOOGLE_DOC_MIME) {
    return {
      exportMimeType: DOCX_DRIVE_MIME,
      kind: "text",
      storagePrefix: DOCX_CONTENT_PREFIX,
    };
  }
  if (mimeType === GOOGLE_SHEET_MIME) {
    return {
      exportMimeType: XLSX_DRIVE_MIME,
      kind: "sheet",
      storagePrefix: XLSX_CONTENT_PREFIX,
    };
  }
  if (mimeType === DOCX_DRIVE_MIME) {
    return {
      exportMimeType: null,
      kind: "text",
      storagePrefix: DOCX_CONTENT_PREFIX,
    };
  }
  if (mimeType === XLSX_DRIVE_MIME) {
    return {
      exportMimeType: null,
      kind: "sheet",
      storagePrefix: XLSX_CONTENT_PREFIX,
    };
  }
  return null;
}

export function isDriveImportableMime(mimeType: string) {
  return resolveDriveImportPlan(mimeType) !== null;
}

/** MIME types we store as chat attachments (after any Drive export). */
export const CHAT_ATTACHABLE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "text/plain",
  "text/markdown",
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
  PPTX_LIBRARY_MIME,
] as const;

export type ChatAttachableMediaType =
  (typeof CHAT_ATTACHABLE_MEDIA_TYPES)[number];

export type ChatAttachPlan = {
  /** How to fetch bytes from Drive (media download vs export). */
  download: "media" | "export";
  exportMimeType?: string;
  /** Content-Type stored on the chat upload. */
  resultMimeType: ChatAttachableMediaType;
  /** Optional extension appended when the source title lacks one (e.g. Google Doc → .pdf). */
  resultExtension?: string;
};

/** Map a source mime to a chat attach plan. Docs→PDF, Sheets→XLSX for storage. */
export function resolveChatAttachPlan(mimeType: string): ChatAttachPlan | null {
  if (mimeType === "image/jpeg" || mimeType === "image/png") {
    return { download: "media", resultMimeType: mimeType };
  }
  if (mimeType === "application/pdf") {
    return { download: "media", resultMimeType: "application/pdf" };
  }
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return { download: "media", resultMimeType: mimeType };
  }
  if (mimeType === DOCX_DRIVE_MIME) {
    return { download: "media", resultMimeType: DOCX_DRIVE_MIME };
  }
  if (mimeType === XLSX_DRIVE_MIME) {
    return { download: "media", resultMimeType: XLSX_DRIVE_MIME };
  }
  if (mimeType === PPTX_LIBRARY_MIME) {
    return { download: "media", resultMimeType: PPTX_LIBRARY_MIME };
  }
  if (mimeType === GOOGLE_DOC_MIME) {
    return {
      download: "export",
      exportMimeType: "application/pdf",
      resultExtension: ".pdf",
      resultMimeType: "application/pdf",
    };
  }
  if (mimeType === GOOGLE_SHEET_MIME) {
    return {
      download: "export",
      exportMimeType: XLSX_DRIVE_MIME,
      resultExtension: ".xlsx",
      resultMimeType: XLSX_DRIVE_MIME,
    };
  }
  return null;
}

export function isChatAttachableMime(mimeType: string) {
  return resolveChatAttachPlan(mimeType) !== null;
}

/** Drive picker filter: same as chat attachable, including Google Docs. */
export function isDriveChatAttachableMime(mimeType: string) {
  return isChatAttachableMime(mimeType);
}

/**
 * SharePoint / Confluence only host binary attachments (no Google Docs mime).
 * Kept as a named alias for those call sites.
 */
export function isChatAttachableImageMime(mimeType: string) {
  return isChatAttachableMime(mimeType);
}

/** True when the stored chat attachment should be sent as a multimodal file part. */
export function isChatNativeFileMediaType(mimeType: string) {
  return (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "application/pdf"
  );
}

/** Infer attachable mime from a file name when the browser omits Content-Type. */
export function chatAttachableMimeFromFileName(
  fileName: string
): ChatAttachableMediaType | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".txt")) {
    return "text/plain";
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return "text/markdown";
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
  return null;
}

export function ensureChatAttachFileName(
  title: string,
  plan: ChatAttachPlan
): string {
  const trimmed = title.trim() || "Untitled";
  if (!plan.resultExtension) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  if (lower.endsWith(plan.resultExtension)) {
    return trimmed;
  }
  return `${trimmed}${plan.resultExtension}`;
}

export const MAX_CHAT_ATTACH_BYTES = 5 * 1024 * 1024;

export function wrapDriveBytesAsArtifactContent(
  plan: DriveImportPlan,
  bytes: Buffer
) {
  return `${plan.storagePrefix}${bytes.toString("base64")}`;
}
