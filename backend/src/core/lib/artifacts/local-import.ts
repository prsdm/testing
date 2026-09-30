import { materializeXlsxFormulas } from "@/core/lib/artifacts/sheet-xlsx-exceljs";
import {
  MAX_DRIVE_IMPORT_BYTES,
  resolveDriveImportPlan,
  wrapDriveBytesAsArtifactContent,
} from "@/shared/artifacts/drive-import";
import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";

export type LocalArtifactImport = {
  kind: "text" | "sheet";
  title: string;
  content: string;
};

function titleFromFileName(fileName: string) {
  const trimmed = fileName.trim() || "Untitled";
  return trimmed.replace(/\.(docx|xlsx)$/i, "") || "Untitled";
}

function resolveLocalImportMime(file: {
  type: string;
  name: string;
}): string | null {
  if (file.type === DOCX_DRIVE_MIME || file.type === XLSX_DRIVE_MIME) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".docx")) {
    return DOCX_DRIVE_MIME;
  }
  if (lower.endsWith(".xlsx")) {
    return XLSX_DRIVE_MIME;
  }
  return null;
}

/**
 * Build stored artifact content from a local .docx / .xlsx upload.
 * PDF is not supported here — there is no PDF canvas editor (only text/sheet).
 */
export async function buildArtifactFromLocalUpload(args: {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<LocalArtifactImport> {
  const mimeType =
    resolveLocalImportMime({ name: args.fileName, type: args.mimeType }) ??
    null;
  if (!mimeType) {
    throw new Error(
      "Only .docx and .xlsx files can be opened in the editor. Use Attach or Select file for PDFs."
    );
  }

  const plan = resolveDriveImportPlan(mimeType);
  if (!plan) {
    throw new Error("Unsupported file type for the editor.");
  }

  if (args.bytes.byteLength === 0) {
    throw new Error("File is empty.");
  }
  if (args.bytes.byteLength > MAX_DRIVE_IMPORT_BYTES) {
    throw new Error(
      `File is too large to open in Kimiro (max ${Math.floor(MAX_DRIVE_IMPORT_BYTES / (1024 * 1024))}MB).`
    );
  }

  const wrapped = wrapDriveBytesAsArtifactContent(plan, args.bytes);
  const content =
    plan.kind === "sheet" ? await materializeXlsxFormulas(wrapped) : wrapped;

  return {
    content,
    kind: plan.kind,
    title: titleFromFileName(args.fileName),
  };
}
