import { tool } from "ai";
import { z } from "zod";
import type {
  ResolvedWebContentProvider,
  ResolvedWebSearchProvider,
} from "@/core/lib/db/web-search-queries";
import type { SharedCitationContext } from "@/core/lib/search/citation-context";
import { stabilizeCitedDocuments } from "@/core/lib/search/citation-context";
import {
  citedDocumentsFromWebSearchResults,
  toUiCitedWebDocument,
} from "@/core/lib/web-search/cited-documents";
import { crawlUrl } from "@/core/lib/web-search/crawl/index";
import {
  toWebSearchModelText,
  toWebSearchUiOutput,
  type WebSearchResultItem,
  type WebSearchToolOutput,
} from "@/core/lib/web-search/output";
import { braveSearch } from "@/core/lib/web-search/search/brave";
import { exaSearch } from "@/core/lib/web-search/search/exa";
import { serperSearch } from "@/core/lib/web-search/search/serper";
import { tavilySearch } from "@/core/lib/web-search/search/tavily";

const MAX_RESULTS = 10;

async function readTopResults(
  results: WebSearchResultItem[],
  contentProvider: ResolvedWebContentProvider,
  maxAutoRead: number
): Promise<Map<string, string>> {
  const contentByUrl = new Map<string, string>();
  if (maxAutoRead <= 0) {
    return contentByUrl;
  }

  const candidates = results.slice(0, MAX_RESULTS);

  const crawled = await Promise.all(
    candidates.map(async (result) => ({
      page: await crawlUrl(result.url, contentProvider),
      url: result.url,
    }))
  );

  for (const { url, page } of crawled) {
    if (contentByUrl.size >= maxAutoRead) {
      break;
    }
    if (page.content.trim() && !page.error) {
      contentByUrl.set(url, page.content);
    }
  }

  return contentByUrl;
}

async function runSearchProvider(
  provider: ResolvedWebSearchProvider,
  query: string
): Promise<WebSearchResultItem[]> {
  if (provider.providerType === "serper") {
    if (!provider.apiKey) {
      return [];
    }
    const results = await serperSearch({
      apiKey: provider.apiKey,
      maxResults: MAX_RESULTS,
      query,
    });
    return results.map((result) => ({
      snippet: result.snippet,
      title: result.title,
      url: result.url,
    }));
  }

  if (provider.providerType === "tavily") {
    if (!provider.apiKey) {
      return [];
    }
    const results = await tavilySearch({
      apiKey: provider.apiKey,
      maxResults: MAX_RESULTS,
      query,
    });
    return results.map((result) => ({
      snippet: result.snippet,
      title: result.title,
      url: result.url,
    }));
  }

  if (provider.providerType === "exa") {
    if (!provider.apiKey) {
      return [];
    }
    const results = await exaSearch({
      apiKey: provider.apiKey,
      maxResults: MAX_RESULTS,
      query,
    });
    return results.map((result) => ({
      snippet: result.snippet,
      title: result.title,
      url: result.url,
    }));
  }

  if (provider.providerType === "brave") {
    if (!provider.apiKey) {
      return [];
    }
    const results = await braveSearch({
      apiKey: provider.apiKey,
      maxResults: MAX_RESULTS,
      query,
    });
    return results.map((result) => ({
      snippet: result.snippet,
      title: result.title,
      url: result.url,
    }));
  }

  return [];
}

export const webSearch = (input: {
  provider: ResolvedWebSearchProvider;
  contentProvider: ResolvedWebContentProvider;
  maxAutoReadPages: number;
  citationContext?: SharedCitationContext;
}) =>
  tool({
    description:
      "Search the public web for up-to-date information and current events. Returns titles, URLs, snippets, and the full page content of the top results. Pass a focused query string; call again with different phrasing if results are thin.",
    execute: async ({ query }) => {
      let results: WebSearchResultItem[] = [];
      let error: string | undefined;

      try {
        results = await runSearchProvider(input.provider, query);
      } catch (reason) {
        error = reason instanceof Error ? reason.message : "Web search failed";
      }

      const contentByUrl =
        results.length > 0
          ? await readTopResults(
              results,
              input.contentProvider,
              input.maxAutoReadPages
            )
          : new Map<string, string>();

      const cited = stabilizeCitedDocuments(
        citedDocumentsFromWebSearchResults(results, contentByUrl),
        input.citationContext,
        error ? `Web search failed: ${error}` : "No web results found."
      );

      const output: WebSearchToolOutput = {
        citationMap: cited.citationMap,
        documents: cited.documents.map(toUiCitedWebDocument),
        query,
        readUrls: [...contentByUrl.keys()],
        results,
        ...(results.length === 0 && error ? { error } : {}),
      };

      const uiOutput = toWebSearchUiOutput(output);
      return {
        contextForLlm: toWebSearchModelText(cited.contextForLlm),
        input: { query },
        output: uiOutput,
      };
    },
    inputSchema: z.object({
      query: z.string().min(1).describe("Web search query"),
    }),
  });
