export type WebSearchProviderCategory = "search" | "content";

export type WebSearchProviderType = "serper" | "tavily" | "exa" | "brave";

export type WebContentProviderType = "builtin_crawler" | "firecrawl";

export type WebSearchProviderMetadata = {
  type: WebSearchProviderType;
  label: string;
  subtitle: string;
  helper: string;
  apiKeyUrl?: string;
  requiresApiKey: boolean;
};

export type WebContentProviderMetadata = {
  type: WebContentProviderType;
  label: string;
  subtitle: string;
  helper: string;
  apiKeyUrl?: string;
  requiresApiKey: boolean;
  builtin: boolean;
};

export const SEARCH_PROVIDERS: WebSearchProviderMetadata[] = [
  {
    apiKeyUrl: "https://serper.dev/api-key",
    helper: "Connect Serper to search Google results for Kimiro.",
    label: "Serper",
    requiresApiKey: true,
    subtitle: "Serper.dev",
    type: "serper",
  },
  {
    apiKeyUrl: "https://app.tavily.com/home",
    helper: "Connect Tavily for AI-optimized web search results.",
    label: "Tavily",
    requiresApiKey: true,
    subtitle: "tavily.com",
    type: "tavily",
  },
  {
    apiKeyUrl: "https://dashboard.exa.ai/api-keys",
    helper: "Connect Exa for neural web search tuned for Kimiro.",
    label: "Exa",
    requiresApiKey: true,
    subtitle: "exa.ai",
    type: "exa",
  },
  {
    apiKeyUrl: "https://api-dashboard.search.brave.com/app/keys",
    helper: "Connect Brave Search for results from an independent web index.",
    label: "Brave",
    requiresApiKey: true,
    subtitle: "search.brave.com",
    type: "brave",
  },
];

export const CONTENT_PROVIDERS: WebContentProviderMetadata[] = [
  {
    builtin: true,
    helper:
      "Kimi's built-in crawler fetches full page content from search results. No setup required.",
    label: "Built-in crawler",
    requiresApiKey: false,
    subtitle: "Included",
    type: "builtin_crawler",
  },
  {
    apiKeyUrl: "https://www.firecrawl.dev/app/api-keys",
    builtin: false,
    helper: "Connect Firecrawl for more reliable scraping of complex pages.",
    label: "Firecrawl",
    requiresApiKey: true,
    subtitle: "firecrawl.dev",
    type: "firecrawl",
  },
];

export const DEFAULT_CONTENT_PROVIDER_TYPE: WebContentProviderType =
  "builtin_crawler";

const SEARCH_PROVIDER_TYPES = new Set<string>(
  SEARCH_PROVIDERS.map((provider) => provider.type)
);

const CONTENT_PROVIDER_TYPES = new Set<string>(
  CONTENT_PROVIDERS.map((provider) => provider.type)
);

export function isWebSearchProviderType(
  value: string
): value is WebSearchProviderType {
  return SEARCH_PROVIDER_TYPES.has(value);
}

export function isWebContentProviderType(
  value: string
): value is WebContentProviderType {
  return CONTENT_PROVIDER_TYPES.has(value);
}

export function getSearchProviderMetadata(type: string) {
  return SEARCH_PROVIDERS.find((provider) => provider.type === type) ?? null;
}

export function getContentProviderMetadata(type: string) {
  return CONTENT_PROVIDERS.find((provider) => provider.type === type) ?? null;
}

export function searchProviderRequiresApiKey(type: string) {
  return getSearchProviderMetadata(type)?.requiresApiKey ?? false;
}

export function contentProviderRequiresApiKey(type: string) {
  return getContentProviderMetadata(type)?.requiresApiKey ?? false;
}
