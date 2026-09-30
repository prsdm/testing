import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { read, utils } from "xlsx";

const MAX_CONTENT_CHARS = 32_000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function normalizeText(value: string) {
  const normalized = value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim();
  return normalized.length > 0 ? normalized : "";
}

function truncateContent(content: string) {
  if (content.length <= MAX_CONTENT_CHARS) {
    return content;
  }
  return `${content.slice(0, MAX_CONTENT_CHARS)}\n\n[Content truncated]`;
}

async function extractPdfText(raw: Buffer) {
  const result = await pdfParse(raw);
  return normalizeText(result.text ?? "");
}

async function extractDocxText(raw: Buffer) {
  const result = await mammoth.extractRawText({ buffer: raw });
  return normalizeText(result.value ?? "");
}

function extractXlsxText(raw: Buffer) {
  const workbook = read(raw, { type: "buffer" });
  const sheets = workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return [];
    }
    const csv = utils.sheet_to_csv(sheet, { blankrows: false }).trim();
    if (!csv) {
      return [];
    }
    return [`# ${sheetName}\n${csv}`];
  });
  return normalizeText(sheets.join("\n\n"));
}

function uploadKind(file: File) {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf" as const;
  }
  if (
    file.type === "text/plain" ||
    file.type === "text/markdown" ||
    name.endsWith(".txt") ||
    name.endsWith(".md")
  ) {
    return "text" as const;
  }
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx" as const;
  }
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    name.endsWith(".xlsx")
  ) {
    return "xlsx" as const;
  }
  return null;
}

export function validateKbUploadFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File must be 10 MB or smaller.", ok: false as const };
  }

  if (!uploadKind(file)) {
    return {
      error: "Upload a PDF, .txt, .md, .docx, or .xlsx file.",
      ok: false as const,
    };
  }

  return { ok: true as const };
}

export async function extractKbUploadText(file: File) {
  const validation = validateKbUploadFile(file);
  if (!validation.ok) {
    return validation;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = uploadKind(file);

  let content = "";
  switch (kind) {
    case "pdf":
      content = await extractPdfText(buffer);
      break;
    case "docx":
      content = await extractDocxText(buffer);
      break;
    case "xlsx":
      content = extractXlsxText(buffer);
      break;
    case "text":
      content = normalizeText(buffer.toString("utf8"));
      break;
    default:
      return {
        error: "Upload a PDF, .txt, .md, .docx, or .xlsx file.",
        ok: false as const,
      };
  }

  if (!content) {
    return {
      error: "Could not extract text from the uploaded file.",
      ok: false as const,
    };
  }

  return {
    content: truncateContent(content),
    ok: true as const,
    title: file.name.replace(/\.[^.]+$/, "") || file.name,
  };
}
