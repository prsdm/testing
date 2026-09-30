import type { InternalSearchToolOutput } from "@/shared/search/citations";
import { toUiCitedDocument } from "@/shared/search/internal-search-output";
import type { KnowledgeBaseSearchForChatResult } from "./run-knowledge-base-search";

export function buildKnowledgeBaseSearchToolOutput(
  search: KnowledgeBaseSearchForChatResult
): InternalSearchToolOutput {
  return {
    citationMap: search.citationMap,
    contextForLlm: search.contextForLlm,
    documents: search.documents.map(toUiCitedDocument),
    steps: [
      { queries: search.searchQueries, type: "queries" },
      { type: "done" },
    ],
  };
}
