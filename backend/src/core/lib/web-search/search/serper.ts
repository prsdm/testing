export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const SEARCH_TIMEOUT_MS = 10_000;

type SerperOrganicResult = {
  title?: string;
  link?: string;
  snippet?: string;
};

type SerperResponse = {
  organic?: SerperOrganicResult[];
};

export async function serperSearch(args: {
  apiKey: string;
  query: string;
  maxResults?: number;
}): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(SERPER_ENDPOINT, {
      body: JSON.stringify({
        num: args.maxResults ?? 10,
        q: args.query,
      }),
      headers: {
        "content-type": "application/json",
        "X-API-KEY": args.apiKey,
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Serper request failed with status ${response.status}`);
    }

    const data = (await response.json()) as SerperResponse;
    const organic = data.organic ?? [];

    return organic
      .filter((result) => Boolean(result.link))
      .map((result) => ({
        snippet: result.snippet?.trim() ?? "",
        title: result.title?.trim() || result.link || "Untitled",
        url: result.link as string,
      }));
  } finally {
    clearTimeout(timeout);
  }
}

export async function testSerperConnection(apiKey: string): Promise<boolean> {
  const results = await serperSearch({ apiKey, maxResults: 1, query: "test" });
  return Array.isArray(results);
}
