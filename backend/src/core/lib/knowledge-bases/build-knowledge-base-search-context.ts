import {
  type SharedCitationContext,
  stabilizeCitedDocuments,
} from "@/core/lib/search/citation-context";
import type { CitationMap, CitedDocument } from "@/shared/search/citations";
import type { SearchResultChunk } from "@/shared/search/types";

export const KNOWLEDGE_BASE_SEARCH_MAX_FULL_DOCUMENTS = 4;
export const KNOWLEDGE_BASE_SEARCH_MAX_CHARS_PER_DOCUMENT = 24_000;

export function rankedDocumentIdsFromSearchHits(
  hits: SearchResultChunk[]
): string[] {
  const bestScore = new Map<string, number>();
  const order: string[] = [];

  for (const hit of hits) {
    const previous = bestScore.get(hit.documentId) ?? Number.NEGATIVE_INFINITY;
    if (hit.score > previous) {
      bestScore.set(hit.documentId, hit.score);
    }
    if (!order.includes(hit.documentId)) {
      order.push(hit.documentId);
    }
  }

  return [...order].sort(
    (left, right) => (bestScore.get(right) ?? 0) - (bestScore.get(left) ?? 0)
  );
}

export function mergeKnowledgeBaseSourceChunks(
  chunks: SearchResultChunk[],
  maxChars = KNOWLEDGE_BASE_SEARCH_MAX_CHARS_PER_DOCUMENT
): SearchResultChunk | null {
  if (chunks.length === 0) {
    return null;
  }

  const sorted = [...chunks].sort(
    (left, right) => left.chunkIndex - right.chunkIndex
  );
  const head = sorted[0];
  if (!head) {
    return null;
  }

  let content = "";
  for (const chunk of sorted) {
    if (content.length >= maxChars) {
      break;
    }
    const separator = content ? "\n\n" : "";
    const remaining = maxChars - content.length - separator.length;
    if (remaining <= 0) {
      break;
    }
    content += `${separator}${chunk.content.slice(0, remaining)}`;
  }

  return {
    ...head,
    blurb: content.slice(0, 240),
    content,
  };
}

export function buildKnowledgeBaseSearchCitedContext(args: {
  searchHits: SearchResultChunk[];
  documentsBySourceId: Map<string, SearchResultChunk[]>;
  maxDocuments?: number;
  maxCharsPerDocument?: number;
  citationContext?: SharedCitationContext;
}): {
  documents: CitedDocument[];
  citationMap: CitationMap;
  contextForLlm: string;
} {
  const maxDocuments =
    args.maxDocuments ?? KNOWLEDGE_BASE_SEARCH_MAX_FULL_DOCUMENTS;
  const maxCharsPerDocument =
    args.maxCharsPerDocument ?? KNOWLEDGE_BASE_SEARCH_MAX_CHARS_PER_DOCUMENT;

  const rankedSourceIds = rankedDocumentIdsFromSearchHits(
    args.searchHits
  ).slice(0, maxDocuments);

  const mergedResults: SearchResultChunk[] = [];
  for (const sourceId of rankedSourceIds) {
    const merged = mergeKnowledgeBaseSourceChunks(
      args.documentsBySourceId.get(sourceId) ?? [],
      maxCharsPerDocument
    );
    if (merged) {
      mergedResults.push(merged);
    }
  }

  const rawDocuments: CitedDocument[] = mergedResults.map((chunk) => ({
    blurb: chunk.blurb || undefined,
    content: chunk.content,
    document: 0,
    documentId: chunk.documentId,
    link: chunk.link,
    sourceConnectorType: chunk.sourceConnectorType,
    sourceType: chunk.sourceType,
    title: chunk.title,
    updatedAt: chunk.updatedAt,
  }));

  return stabilizeCitedDocuments(
    rawDocuments,
    args.citationContext,
    "No matching passages were found in this knowledge base's indexed files for this query."
  );
}
