import type { SearchResultChunk } from "@/shared/search/types";

/** Live federated adapter result — empty results may still carry a soft error. */
export type FederatedSourceResult = {
  results: SearchResultChunk[];
  /** Soft failure (missing connector, auth/API). */
  error?: string;
};

export type FederatedSlackSourceResult = {
  keywordResults: SearchResultChunk[];
  dmResults: SearchResultChunk[];
  error?: string;
};

export function federatedErrorMessage(source: string, error: unknown): string {
  const detail =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : "request failed";

  const lower = detail.toLowerCase();
  if (
    source === "Gmail" &&
    (lower.includes("insufficient") ||
      lower.includes("permission") ||
      lower.includes("403"))
  ) {
    return "Gmail: mail permission missing on the Google token. Reconnect Gmail in Sources (approve mail access), then try again.";
  }

  // Keep short; avoid dumping stack/HTML into the model context.
  return `${source}: ${detail.slice(0, 160)}`;
}
