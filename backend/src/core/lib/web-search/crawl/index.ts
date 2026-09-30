import type { ResolvedWebContentProvider } from "@/core/lib/db/web-search-queries";
import { builtinCrawl, type CrawledPage } from "./builtin";

export type { CrawledPage } from "./builtin";

export function crawlUrl(
  url: string,
  _provider: ResolvedWebContentProvider
): Promise<CrawledPage> {
  // Firecrawl and other providers are planned follow-ups; fall back to the
  // built-in crawler for every provider type in v1.
  return builtinCrawl(url);
}
