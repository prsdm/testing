import { testBraveConnection } from "@/core/lib/web-search/search/brave";
import { testExaConnection } from "@/core/lib/web-search/search/exa";
import { testSerperConnection } from "@/core/lib/web-search/search/serper";
import { testTavilyConnection } from "@/core/lib/web-search/search/tavily";
import type { WebSearchProviderCategory } from "@/shared/web-search/providers";

export async function testWebSearchProviderConnection(args: {
  category: WebSearchProviderCategory;
  providerType: string;
  apiKey: string;
}): Promise<void> {
  if (args.category === "search" && args.providerType === "serper") {
    const ok = await testSerperConnection(args.apiKey);
    if (!ok) {
      throw new Error("Serper connection test failed");
    }
    return;
  }

  if (args.category === "search" && args.providerType === "tavily") {
    const ok = await testTavilyConnection(args.apiKey);
    if (!ok) {
      throw new Error("Tavily connection test failed");
    }
    return;
  }

  if (args.category === "search" && args.providerType === "exa") {
    const ok = await testExaConnection(args.apiKey);
    if (!ok) {
      throw new Error("Exa connection test failed");
    }
    return;
  }

  if (args.category === "search" && args.providerType === "brave") {
    const ok = await testBraveConnection(args.apiKey);
    if (!ok) {
      throw new Error("Brave connection test failed");
    }
    return;
  }

  // Content providers (firecrawl) will add their own test paths later.
  throw new Error("Connection testing is not supported for this provider");
}
