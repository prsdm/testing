import { z } from "zod";
import {
  LIBRARY_ALLOWED_CONTENT_TYPES,
  MAX_LIBRARY_FILE_BYTES,
  sanitizeLibraryFileName,
} from "@/shared/library/constants";
import { libraryContentTypeFromFileName } from "@/shared/library/content-type";

const saveToLibraryFieldsSchema = z.object({
  content: z.string().optional(),
  contentEncoding: z.enum(["utf8", "base64"]).optional(),
  contentType: z.string().optional(),
  filename: z.string().min(1).max(180),
  sandboxPath: z.string().max(240).optional(),
});

/** Strip empty content when the model sends both sandboxPath and content: "". */
export function coerceSaveToLibraryInput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const record = raw as Record<string, unknown>;
  const sandboxPath =
    typeof record.sandboxPath === "string" ? record.sandboxPath.trim() : "";
  const content =
    typeof record.content === "string" ? record.content.trim() : "";

  if (sandboxPath) {
    return {
      filename: record.filename,
      sandboxPath,
      ...(typeof record.contentType === "string"
        ? { contentType: record.contentType }
        : {}),
    };
  }

  return {
    ...record,
    ...(content ? { content } : {}),
  };
}

export const saveToLibraryInputSchema = z.preprocess(
  coerceSaveToLibraryInput,
  saveToLibraryFieldsSchema.superRefine((data, ctx) => {
    const hasContent = Boolean(data.content?.trim());
    const hasSandboxPath = Boolean(data.sandboxPath?.trim());
    if (hasContent === hasSandboxPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: hasSandboxPath
          ? "Provide exactly one of content or sandboxPath."
          : "Provide content for text exports or sandboxPath for files under outputs/.",
      });
    }
    if (hasSandboxPath && !data.sandboxPath?.trim().startsWith("outputs/")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sandboxPath must be a file under outputs/.",
        path: ["sandboxPath"],
      });
    }
  })
);

export type SaveToLibraryToolInput = z.infer<typeof saveToLibraryFieldsSchema>;

export type NormalizedSaveToLibraryInput =
  | {
      filename: string;
      contentType: string;
      source: { kind: "text"; content: string };
    }
  | {
      filename: string;
      contentType: string;
      source: { kind: "sandbox"; sandboxPath: string };
    }
  | {
      filename: string;
      contentType: string;
      source: { kind: "base64"; content: string };
    };

export type SaveToLibraryToolOutput = {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  contextForLlm: string;
};

export const SAVE_TO_LIBRARY_RETRY_BLOCKED_MESSAGE =
  "Deliverable creation already failed in this turn. Do not call saveToLibrary again — explain the failure to the user.";

/** Tool result text for the model — preview UI handles file identity and download. */
export function saveToLibrarySuccessContextForLlm(args: {
  libraryFileId: string;
  sandboxPath?: string;
}) {
  const editHint = args.sandboxPath
    ? ` Edit in this chat via sandboxExec at ${args.sandboxPath}, or importLibraryToSandbox with libraryFileId ${args.libraryFileId}.`
    : ` For later edits, importLibraryToSandbox with libraryFileId ${args.libraryFileId}.`;
  return `Deliverable ready (libraryFileId ${args.libraryFileId}). Preview card shown in chat.${editHint} Describe what you created only — no filename, download link, or save location in your message.`;
}

export function isFailedSaveToLibraryResult(result: unknown): boolean {
  if (!result || typeof result !== "object") {
    return false;
  }
  const record = result as { error?: unknown };
  return typeof record.error === "string" && record.error.trim().length > 0;
}

function resolveContentType(filename: string, explicit?: string): string {
  const trimmed = explicit?.trim();
  if (trimmed) {
    return trimmed;
  }
  return libraryContentTypeFromFileName(filename) ?? "text/plain";
}

function assertAllowedContentType(contentType: string): string | null {
  if (
    !(LIBRARY_ALLOWED_CONTENT_TYPES as readonly string[]).includes(contentType)
  ) {
    return `Unsupported content type: ${contentType}`;
  }
  return null;
}

export function normalizeSaveToLibraryInput(
  input: unknown
): NormalizedSaveToLibraryInput | { error: string; contextForLlm: string } {
  const parsed = saveToLibraryInputSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((issue) => issue.message)
      .join("; ");
    return { contextForLlm: message, error: message };
  }

  const filename = sanitizeLibraryFileName(parsed.data.filename);
  const contentType = resolveContentType(filename, parsed.data.contentType);
  const contentTypeError = assertAllowedContentType(contentType);
  if (contentTypeError) {
    return { contextForLlm: contentTypeError, error: contentTypeError };
  }

  if (parsed.data.sandboxPath?.trim()) {
    return {
      contentType,
      filename,
      source: {
        kind: "sandbox",
        sandboxPath: parsed.data.sandboxPath.trim().replaceAll("\\", "/"),
      },
    };
  }

  const content = parsed.data.content ?? "";
  const encoding = parsed.data.contentEncoding ?? "utf8";

  if (encoding === "base64") {
    let decoded: Buffer;
    try {
      decoded = Buffer.from(content, "base64");
    } catch {
      const message = "Invalid base64 content.";
      return { contextForLlm: message, error: message };
    }
    if (decoded.byteLength > MAX_LIBRARY_FILE_BYTES) {
      const message = `File exceeds ${MAX_LIBRARY_FILE_BYTES} bytes`;
      return { contextForLlm: message, error: message };
    }
    if (decoded.byteLength === 0) {
      const message = "Content is empty.";
      return { contextForLlm: message, error: message };
    }
    return {
      contentType,
      filename,
      source: { content, kind: "base64" },
    };
  }

  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_LIBRARY_FILE_BYTES) {
    const message = `File exceeds ${MAX_LIBRARY_FILE_BYTES} bytes`;
    return { contextForLlm: message, error: message };
  }

  return {
    contentType,
    filename,
    source: { content, kind: "text" },
  };
}

export const listLibraryInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional(),
});

export type ListLibraryToolInput = z.infer<typeof listLibraryInputSchema>;

export type ListLibraryToolOutput = {
  files: Array<{
    id: string;
    name: string;
    contentType: string;
    sizeBytes: number;
    url: string;
    source: string;
    createdAt: string;
  }>;
  contextForLlm: string;
};
