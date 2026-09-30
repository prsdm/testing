import mammoth from "mammoth";
import { read, utils } from "xlsx";
import { readChatUploadBytesForUser } from "@/core/lib/chat/chat-upload";
import { isChatNativeFileMediaType } from "@/shared/artifacts/drive-import";
import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";
import type { ChatMessage } from "@/shared/types";

const MAX_EXTRACTED_CHARS = 32_000;

function pathnameFromChatFileUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "http://localhost");
    if (!parsed.pathname.endsWith("/api/files/content")) {
      return null;
    }
    const pathname = parsed.searchParams.get("pathname")?.trim();
    return pathname || null;
  } catch {
    return null;
  }
}

function truncateExtracted(content: string) {
  if (content.length <= MAX_EXTRACTED_CHARS) {
    return content;
  }
  return `${content.slice(0, MAX_EXTRACTED_CHARS)}\n\n[Content truncated]`;
}

function normalizeExtracted(value: string) {
  return value.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
}

async function extractDocxText(bytes: Buffer) {
  const result = await mammoth.extractRawText({ buffer: bytes });
  return normalizeExtracted(result.value ?? "");
}

function extractXlsxText(bytes: Buffer) {
  const workbook = read(bytes, { type: "buffer" });
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
  return normalizeExtracted(sheets.join("\n\n"));
}

/**
 * Rewrite UI file parts into model-ready parts (Select file / Attach files):
 * - JPEG/PNG/PDF → data URLs (providers cannot fetch session-gated relative URLs)
 * - DOCX / XLSX / plain text → extracted text parts
 */
export async function prepareUiMessagesForModel(args: {
  messages: ChatMessage[];
  userId: string;
}): Promise<ChatMessage[]> {
  const prepared: ChatMessage[] = [];

  for (const message of args.messages) {
    if (message.role !== "user") {
      prepared.push(message);
      continue;
    }

    const nextParts: ChatMessage["parts"] = [];
    for (const part of message.parts) {
      if (part.type !== "file") {
        nextParts.push(part);
        continue;
      }

      const pathname = pathnameFromChatFileUrl(part.url);
      if (!pathname) {
        nextParts.push(part);
        continue;
      }

      const object = await readChatUploadBytesForUser({
        pathname,
        userId: args.userId,
      });
      if (!object) {
        nextParts.push(part);
        continue;
      }

      const mediaType = part.mediaType || object.contentType;
      const partRecord = part as { filename?: unknown; name?: unknown };
      const fileName =
        (typeof partRecord.filename === "string" &&
          partRecord.filename.trim()) ||
        (typeof partRecord.name === "string" && partRecord.name.trim()) ||
        "file";

      if (isChatNativeFileMediaType(mediaType)) {
        nextParts.push({
          filename: fileName,
          mediaType,
          type: "file",
          url: `data:${mediaType};base64,${object.bytes.toString("base64")}`,
        });
        continue;
      }

      let text = "";
      if (
        mediaType === "text/plain" ||
        mediaType === "text/markdown" ||
        mediaType.startsWith("text/")
      ) {
        text = normalizeExtracted(object.bytes.toString("utf8"));
      } else if (mediaType === DOCX_DRIVE_MIME) {
        text = await extractDocxText(object.bytes);
      } else if (mediaType === XLSX_DRIVE_MIME) {
        text = extractXlsxText(object.bytes);
      }

      if (text) {
        nextParts.push({
          text: `Attached file: ${fileName}\n\n${truncateExtracted(text)}`,
          type: "text",
        });
      } else {
        nextParts.push({
          text: `Attached file: ${fileName} (could not extract text)`,
          type: "text",
        });
      }
    }

    prepared.push({ ...message, parts: nextParts });
  }

  return prepared;
}
