import type { ChatHistoryMessage } from "@/core/lib/chat/chat-schemas";
import {
  buildKnowledgeBaseSearchCitedContext,
  rankedDocumentIdsFromSearchHits,
} from "@/core/lib/knowledge-bases/build-knowledge-base-search-context";
import { buildKnowledgeBaseSearchQueries } from "@/core/lib/knowledge-bases/expand-knowledge-base-search-query";
import { searchKnowledgeBase } from "@/core/lib/knowledge-bases/knowledge-base-queries";
import type { SharedCitationContext } from "@/core/lib/search/citation-context";
import { listKnowledgeBaseChunksForSourceItems } from "@/core/lib/search/pg/knowledge-base-chunks";
import type { CitationMap, CitedDocument } from "@/shared/search/citations";
import {
  type SearchResultChunk,
  searchResultChunkKey,
} from "@/shared/search/types";

export type KnowledgeBaseSearchForChatResult = {
  contextForLlm: string;
  resultCount: number;
  searchQueries: string[];
  documents: CitedDocument[];
  citationMap: CitationMap;
};

function mergeSearchResults(
  resultSets: SearchResultChunk[][],
  limit: number
): SearchResultChunk[] {
  const byChunkKey = new Map<string, SearchResultChunk>();

  for (const results of resultSets) {
    for (const result of results) {
      const key = searchResultChunkKey(result);
      const existing = byChunkKey.get(key);
      if (!existing || result.score > existing.score) {
        byChunkKey.set(key, result);
      }
    }
  }

  return [...byChunkKey.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export async function runKnowledgeBaseSearchForChat(args: {
  tenantId: string;
  knowledgeBaseId: string;
  userId: string;
  query: string;
  chatHistory?: ChatHistoryMessage[];
  limit?: number;
  citationContext?: SharedCitationContext;
}): Promise<KnowledgeBaseSearchForChatResult> {
  const trimmedQuery = args.query.trim();
  if (!trimmedQuery) {
    return {
      citationMap: {},
      contextForLlm: "",
      documents: [],
      resultCount: 0,
      searchQueries: [],
    };
  }

  const limit = args.limit ?? 8;
  const searchQueries = buildKnowledgeBaseSearchQueries({
    chatHistory: args.chatHistory,
    currentQuery: trimmedQuery,
  });

  const resultSets = await Promise.all(
    searchQueries.map((query) =>
      searchKnowledgeBase({
        knowledgeBaseId: args.knowledgeBaseId,
        limit,
        query,
        tenantId: args.tenantId,
        userId: args.userId,
      })
    )
  );

  const results = mergeSearchResults(resultSets, limit);

  if (results.length === 0) {
    return {
      citationMap: {},
      contextForLlm:
        "No matching passages were found in this knowledge base's indexed files for this query.",
      documents: [],
      resultCount: 0,
      searchQueries,
    };
  }

  const rankedSourceIds = rankedDocumentIdsFromSearchHits(results);
  const allChunks = await listKnowledgeBaseChunksForSourceItems({
    knowledgeBaseId: args.knowledgeBaseId,
    sourceItemIds: rankedSourceIds,
    tenantId: args.tenantId,
  });
  const documentsBySourceId = new Map<string, SearchResultChunk[]>();
  for (const chunk of allChunks) {
    const existing = documentsBySourceId.get(chunk.documentId) ?? [];
    existing.push(chunk);
    documentsBySourceId.set(chunk.documentId, existing);
  }

  const { contextForLlm, documents, citationMap } =
    buildKnowledgeBaseSearchCitedContext({
      citationContext: args.citationContext,
      documentsBySourceId,
      searchHits: results,
    });

  return {
    citationMap,
    contextForLlm,
    documents,
    resultCount: results.length,
    searchQueries,
  };
}
