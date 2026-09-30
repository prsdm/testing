import { getTenantSearchRuntimeSettings } from "@/core/lib/db/search-index-queries";
import { buildUserAclTokensFromMemberships } from "@/core/lib/sources/user-acl-tokens";
import {
  buildCitedDocumentsFromResults,
  type CitationMap,
  type CitedDocument,
} from "@/shared/search/citations";
import type { InternalSearchStep } from "@/shared/search/types";
import { hybridSearchChunks } from "./chunk-index";
import { getTenantIndexName, isIndexingEnabled } from "./config";

export type InternalSearchInput = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userEmail: string;
  query: string;
  citationStartNumber?: number;
};

export type InternalSearchOutput = {
  steps: InternalSearchStep[];
  documents: CitedDocument[];
  citationMap: CitationMap;
  contextForLlm: string;
  error?: string;
};

export async function runInternalSearch(
  input: InternalSearchInput
): Promise<InternalSearchOutput> {
  const emptyOutput = (
    contextForLlm: string,
    error?: string
  ): InternalSearchOutput => ({
    citationMap: {},
    contextForLlm,
    documents: [],
    error,
    steps: [{ type: "done" }],
  });

  try {
    const settings = await getTenantSearchRuntimeSettings(input.tenantId);

    if (!isIndexingEnabled(settings)) {
      return emptyOutput("Internal search is disabled for this tenant.");
    }

    const uniqueAcl = await buildUserAclTokensFromMemberships({
      tenantId: input.tenantId,
      userEmail: input.userEmail,
      userId: input.userId,
    });

    const indexName = getTenantIndexName(input.tenantId);
    const trimmedQuery = input.query.trim();
    const results = trimmedQuery
      ? await hybridSearchChunks({
          accessControlList: uniqueAcl,
          indexName,
          query: trimmedQuery,
          settings,
          tenantId: input.tenantId,
        })
      : [];

    const steps: InternalSearchStep[] = [
      { queries: trimmedQuery ? [trimmedQuery] : [], type: "queries" },
      { results, type: "reading" },
      { type: "done" },
    ];

    const citationStartNumber = input.citationStartNumber ?? 1;
    const { documents, citationMap, contextForLlm } =
      buildCitedDocumentsFromResults(results, citationStartNumber);

    return {
      citationMap,
      contextForLlm,
      documents,
      steps,
    };
  } catch (error) {
    const { sanitizeSearchErrorForLlm } = await import(
      "@/core/lib/search/sanitize-search-error"
    );
    return emptyOutput(sanitizeSearchErrorForLlm(error));
  }
}
