import type { CitationMap, CitedDocument } from "@/shared/search/citations";

export type WebSearchResultItem = {
  title: string;
  url: string;
  snippet: string;
};

/** UI-facing output persisted for the web_search tool part. */
export type WebSearchToolOutput = {
  query: string;
  results: WebSearchResultItem[];
  /** URLs whose full page content was fetched automatically after search. */
  readUrls?: string[];
  documents?: CitedDocument[];
  citationMap?: CitationMap;
  error?: string;
};

export type OpenUrlResultItem = {
  url: string;
  title: string;
  /** Empty in the UI payload; full text only goes to the model. */
  content: string;
  error?: string;
};

/** UI-facing output persisted for the open_url tool part. */
export type OpenUrlToolOutput = {
  urls: string[];
  results: OpenUrlResultItem[];
  documents?: CitedDocument[];
  citationMap?: CitationMap;
  error?: string;
};

export function toWebSearchModelText(contextForLlm: string): string {
  return contextForLlm;
}

/** UI payload omits full page content (kept only for the model). */
export function toWebSearchUiOutput(
  output: WebSearchToolOutput
): WebSearchToolOutput {
  return output;
}

export function toOpenUrlModelText(contextForLlm: string): string {
  return contextForLlm;
}

/** UI payload strips full content to avoid bloating persisted messages. */
export function toOpenUrlUiOutput(
  output: OpenUrlToolOutput
): OpenUrlToolOutput {
  return {
    urls: output.urls,
    ...(output.error ? { error: output.error } : {}),
    ...(output.documents ? { documents: output.documents } : {}),
    ...(output.citationMap ? { citationMap: output.citationMap } : {}),
    results: output.results.map((result) => ({
      content: "",
      title: result.title,
      url: result.url,
      ...(result.error ? { error: result.error } : {}),
    })),
  };
}
