import { getTenantSearchRuntimeSettings } from "@/core/lib/db/search-index-queries";

export const DEFAULT_MAX_INDEXED_CONTENT_SIZE_MB = 10;
export const MAX_INDEXED_CONTENT_SIZE_MB_CAP = 250;
export const TOOL_READ_MAX_CHARS = 32_000;

export function contentUtf8ByteLength(content: string): number {
  return Buffer.byteLength(content, "utf8");
}

export function mbToBytes(mb: number): number {
  return Math.floor(mb * 1024 * 1024);
}

export function contentExceedsMaxBytes(
  content: string,
  maxBytes: number
): boolean {
  return contentUtf8ByteLength(content) > maxBytes;
}

export function formatContentTooLargeError(maxMb: number): string {
  return `Content exceeds the ${maxMb} MB indexing limit for this workspace.`;
}

export class IndexedContentTooLargeError extends Error {
  readonly maxMb: number;

  constructor(maxMb: number) {
    super(formatContentTooLargeError(maxMb));
    this.name = "IndexedContentTooLargeError";
    this.maxMb = maxMb;
  }
}

export function resolveReadableContent(
  text: string,
  options?: { maxContentBytes?: number; maxContentMb?: number }
): { content: string; truncated: boolean } {
  if (options?.maxContentBytes !== undefined) {
    const maxMb =
      options.maxContentMb ??
      Math.round(options.maxContentBytes / (1024 * 1024));
    if (contentExceedsMaxBytes(text, options.maxContentBytes)) {
      throw new IndexedContentTooLargeError(maxMb);
    }
    return { content: text, truncated: false };
  }

  const truncated = text.length > TOOL_READ_MAX_CHARS;
  return {
    content: truncated ? text.slice(0, TOOL_READ_MAX_CHARS) : text,
    truncated,
  };
}

export async function getMaxIndexedContentBytesForTenant(tenantId: string) {
  const settings = await getTenantSearchRuntimeSettings(tenantId);
  const maxMb = settings.maxIndexedContentSizeMb;
  return { maxBytes: mbToBytes(maxMb), maxMb };
}
