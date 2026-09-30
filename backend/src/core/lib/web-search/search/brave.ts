import type { WebSearchResult } from "./serper";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const SEARCH_TIMEOUT_MS = 10_000;

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
};

type BraveResponse = {
  web?: {
    results?: BraveWebResult[];
  };
};

export async function braveSearch(args: {
  apiKey: string;
  query: string;
  maxResults?: number;
}): Promise<WebSearchResult[]> {
  const url = new URL(BRAVE_ENDPOINT);
  url.searchParams.set("q", args.query);
  url.searchParams.set("count", String(args.maxResults ?? 10));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": args.apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        body.trim()
          ? `Brave request failed with status ${response.status}: ${body}`
          : `Brave request failed with status ${response.status}`
      );
    }

    const data = (await response.json()) as BraveResponse;
    const results = data.web?.results ?? [];

    return results
      .filter((result) => Boolean(result.url))
      .map((result) => ({
        snippet: result.description?.trim() ?? "",
        title: result.title?.trim() || result.url || "Untitled",
        url: result.url as string,
      }));
  } finally {
    clearTimeout(timeout);
  }
}

export async function testBraveConnection(apiKey: string): Promise<boolean> {
  const results = await braveSearch({ apiKey, maxResults: 1, query: "test" });
  return results.length > 0;
}
