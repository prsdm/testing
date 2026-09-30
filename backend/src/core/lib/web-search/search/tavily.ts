import { tavily } from "@tavily/core";
import type { WebSearchResult } from "./serper";

const SEARCH_TIMEOUT_SECONDS = 10;

async function withSearchTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Tavily search timed out"));
    }, SEARCH_TIMEOUT_SECONDS * 1000);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function tavilySearch(args: {
  apiKey: string;
  query: string;
  maxResults?: number;
}): Promise<WebSearchResult[]> {
  const client = tavily({ apiKey: args.apiKey });
  const response = await withSearchTimeout(
    client.search(args.query, {
      includeAnswer: false,
      maxResults: args.maxResults ?? 10,
      searchDepth: "basic",
      timeout: SEARCH_TIMEOUT_SECONDS,
    })
  );

  return response.results
    .filter((result) => Boolean(result.url))
    .map((result) => ({
      snippet: result.content?.trim() ?? "",
      title: result.title?.trim() || result.url || "Untitled",
      url: result.url,
    }));
}

export async function testTavilyConnection(apiKey: string): Promise<boolean> {
  const results = await tavilySearch({ apiKey, maxResults: 1, query: "test" });
  return results.length > 0;
}
