import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";
import { PPTX_LIBRARY_MIME } from "@/shared/library/content-type";

export type LibraryPreviewKind =
  | "sheet"
  | "text"
  | "slides"
  | "image"
  | "pdf"
  | "unsupported";

export function libraryPreviewKindFromMeta(args: {
  name: string;
  contentType: string;
}): LibraryPreviewKind {
  const contentType = args.contentType.trim().toLowerCase();
  const lowerName = args.name.trim().toLowerCase();

  if (contentType === XLSX_DRIVE_MIME || lowerName.endsWith(".xlsx")) {
    return "sheet";
  }
  if (contentType === DOCX_DRIVE_MIME || lowerName.endsWith(".docx")) {
    return "text";
  }
  if (contentType === PPTX_LIBRARY_MIME || lowerName.endsWith(".pptx")) {
    return "slides";
  }
  if (
    contentType.startsWith("image/") ||
    /\.(jpe?g|png|webp)$/i.test(lowerName)
  ) {
    return "image";
  }
  if (contentType === "application/pdf" || lowerName.endsWith(".pdf")) {
    return "pdf";
  }
  return "unsupported";
}

export function isLibraryPreviewSupported(args: {
  name: string;
  contentType: string;
}): boolean {
  return libraryPreviewKindFromMeta(args) !== "unsupported";
}

export function libraryPreviewSkipsServerConversion(
  kind: LibraryPreviewKind
): boolean {
  return (
    kind === "slides" || kind === "text" || kind === "sheet" || kind === "pdf"
  );
}

export function isLibraryCloudExportSupportedKind(
  kind: LibraryPreviewKind
): boolean {
  return (
    kind === "text" || kind === "sheet" || kind === "slides" || kind === "pdf"
  );
}

export function isLibraryCloudExportSupported(args: {
  name: string;
  contentType: string;
}): boolean {
  return isLibraryCloudExportSupportedKind(libraryPreviewKindFromMeta(args));
}

const GOOGLE_APPS_TARGET_MIME: Partial<Record<LibraryPreviewKind, string>> = {
  sheet: "application/vnd.google-apps.spreadsheet",
  slides: "application/vnd.google-apps.presentation",
  text: "application/vnd.google-apps.document",
};

/** Google Workspace mime for in-browser open without Office conversion. */
export function libraryGoogleAppsTargetMime(args: {
  name: string;
  contentType: string;
}): string | null {
  const kind = libraryPreviewKindFromMeta(args);
  return GOOGLE_APPS_TARGET_MIME[kind] ?? null;
}

export function libraryPreviewKindSubtitle(kind: LibraryPreviewKind): string {
  switch (kind) {
    case "slides":
      return "PowerPoint";
    case "sheet":
      return "Spreadsheet";
    case "text":
      return "Word document";
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    default:
      return "File";
  }
}

/** User-facing tool card labels for saveToLibrary — never mention "library". */
export function deliverableToolLabel(
  kind: LibraryPreviewKind,
  phase: "pending" | "completed"
): string {
  if (kind === "unsupported") {
    return phase === "pending" ? "Preparing file" : "Created file";
  }
  const noun = libraryPreviewKindSubtitle(kind).toLowerCase();
  return phase === "pending" ? `Creating ${noun}` : `Created ${noun}`;
}
