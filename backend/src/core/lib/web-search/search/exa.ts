import Exa from "exa-js";
import type { WebSearchResult } from "./serper";

const SEARCH_TIMEOUT_MS = 10_000;

type ExaResultSnippet = {
  title?: string | null;
  url: string;
  highlights?: string[];
  text?: string;
};

function snippetFromResult(result: ExaResultSnippet) {
  const highlight = result.highlights?.find((entry) => entry.trim().length > 0);
  if (highlight) {
    return highlight.trim();
  }
  if (result.text?.trim()) {
    const normalized = result.text.replace(/\s+/g, " ").trim();
    return normalized.length > 300
      ? `${normalized.slice(0, 300).trimEnd()}…`
      : normalized;
  }
  return "";
}

async function withSearchTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Exa search timed out"));
    }, SEARCH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function exaSearch(args: {
  apiKey: string;
  query: string;
  maxResults?: number;
}): Promise<WebSearchResult[]> {
  const exa = new Exa(args.apiKey);
  const response = await withSearchTimeout(
    exa.search(args.query, {
      // Skip Exa content fetch — we crawl top results ourselves. Requesting only
      // highlights with the default filterEmptyResults=true can drop every result.
      contents: false,
      numResults: args.maxResults ?? 10,
      type: "auto",
    })
  );

  return response.results
    .filter((result) => Boolean(result.url))
    .map((result) => ({
      snippet: snippetFromResult(result),
      title: result.title?.trim() || result.url || "Untitled",
      url: result.url,
    }));
}

export async function testExaConnection(apiKey: string): Promise<boolean> {
  const results = await exaSearch({ apiKey, maxResults: 1, query: "test" });
  return results.length > 0;
}
