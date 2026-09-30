import JSZip from "jszip";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { read, utils } from "xlsx";
import type { DriveFileToIndex } from "./fetch";

const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const EPUB_MIME_TYPE = "application/epub+zip";
const RFC822_MIME_TYPE = "message/rfc822";

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
]);

function decodeXmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function normalizeText(value: string) {
  const normalized = value
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function stripHtmlTags(value: string) {
  return value
    .replaceAll(/<script[\s\S]*?<\/script>/gi, " ")
    .replaceAll(/<style[\s\S]*?<\/style>/gi, " ")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ");
}

function extension(fileName: string) {
  const idx = fileName.lastIndexOf(".");
  if (idx < 0) {
    return "";
  }
  return fileName.slice(idx).toLowerCase();
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

async function extractPptxText(raw: Buffer) {
  const zip = await JSZip.loadAsync(raw);
  const slideNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const aNum = Number.parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const bNum = Number.parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return aNum - bNum;
    });

  const slides: string[] = [];
  for (const slideName of slideNames) {
    const slideFile = zip.file(slideName);
    if (!slideFile) {
      continue;
    }
    const xml = await slideFile.async("string");
    const textRuns = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map(
      (match) => decodeXmlEntities(match[1] ?? "").trim()
    );
    const slideText = textRuns.filter(Boolean).join("\n").trim();
    if (slideText) {
      slides.push(slideText);
    }
  }

  return normalizeText(slides.join("\n\n"));
}

async function extractEpubText(raw: Buffer) {
  const zip = await JSZip.loadAsync(raw);
  const pageNames = Object.keys(zip.files).filter((name) =>
    /\.(xhtml|html|htm)$/i.test(name)
  );

  const pages: string[] = [];
  for (const pageName of pageNames) {
    const page = zip.file(pageName);
    if (!page) {
      continue;
    }
    const html = await page.async("string");
    const text = decodeXmlEntities(stripHtmlTags(html)).trim();
    if (text) {
      pages.push(text);
    }
  }

  return normalizeText(pages.join("\n\n"));
}

export async function extractDriveFileText(input: {
  file: DriveFileToIndex;
  raw: Buffer;
}) {
  const mimeType = input.file.mimeType;
  const ext = extension(input.file.name);

  if (mimeType === PDF_MIME_TYPE || ext === ".pdf") {
    return await extractPdfText(input.raw);
  }
  if (mimeType === DOCX_MIME_TYPE || ext === ".docx") {
    return await extractDocxText(input.raw);
  }
  if (mimeType === XLSX_MIME_TYPE || ext === ".xlsx" || ext === ".xlsm") {
    return extractXlsxText(input.raw);
  }
  if (mimeType === PPTX_MIME_TYPE || ext === ".pptx") {
    return await extractPptxText(input.raw);
  }
  if (mimeType === EPUB_MIME_TYPE || ext === ".epub") {
    return await extractEpubText(input.raw);
  }
  if (mimeType === RFC822_MIME_TYPE || ext === ".eml") {
    return normalizeText(input.raw.toString("utf8"));
  }
  if (TEXT_MIME_TYPES.has(mimeType)) {
    return normalizeText(input.raw.toString("utf8"));
  }

  return null;
}
