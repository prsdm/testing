import { codeDocumentFileName } from "@/shared/artifacts/download-document";
import {
  encodeCsvAsXlsxContent,
  isXlsxStoredContent,
  sheetFileName,
  XLSX_CONTENT_PREFIX,
} from "@/shared/artifacts/sheet-xlsx";
import {
  DOCX_CONTENT_PREFIX,
  encodeMarkdownAsDocxContent,
  isDocxStoredContent,
  textDocumentFileName,
} from "@/shared/artifacts/text-docx";

export const DOCX_DRIVE_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const XLSX_DRIVE_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const PLAIN_TEXT_DRIVE_MIME = "text/plain";

export type DriveExportKind = "text" | "sheet" | "code";

export type PreparedDriveExport = {
  name: string;
  mimeType: string;
  contentBase64: string;
};

/** Strip storage prefixes / encode so Drive receives raw file bytes (base64). */
export async function prepareArtifactDriveExport(args: {
  kind: DriveExportKind;
  title: string;
  content: string;
}): Promise<PreparedDriveExport> {
  const content = args.content ?? "";

  if (args.kind === "sheet") {
    const name = sheetFileName(args.title || "Spreadsheet");
    if (isXlsxStoredContent(content)) {
      return {
        contentBase64: content.slice(XLSX_CONTENT_PREFIX.length),
        mimeType: XLSX_DRIVE_MIME,
        name,
      };
    }
    const encoded = encodeCsvAsXlsxContent(content, args.title || "Sheet1");
    return {
      contentBase64: encoded.slice(XLSX_CONTENT_PREFIX.length),
      mimeType: XLSX_DRIVE_MIME,
      name,
    };
  }

  if (args.kind === "text") {
    const name = textDocumentFileName(args.title || "Document");
    if (isDocxStoredContent(content)) {
      return {
        contentBase64: content.slice(DOCX_CONTENT_PREFIX.length),
        mimeType: DOCX_DRIVE_MIME,
        name,
      };
    }
    const encoded = await encodeMarkdownAsDocxContent(content);
    return {
      contentBase64: encoded.slice(DOCX_CONTENT_PREFIX.length),
      mimeType: DOCX_DRIVE_MIME,
      name,
    };
  }

  const name = codeDocumentFileName(args.title || "code");
  return {
    contentBase64: Buffer.from(content, "utf8").toString("base64"),
    mimeType: PLAIN_TEXT_DRIVE_MIME,
    name,
  };
}
