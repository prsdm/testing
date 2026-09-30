import type {
  CitationMap,
  CitedDocument,
  InternalSearchToolOutput,
} from "./citations";
import type { InternalSearchStep, SearchResultChunk } from "./types";

export type InternalSearchOutput = {
  steps: InternalSearchStep[];
  documents: CitedDocument[];
  citationMap: CitationMap;
  contextForLlm: string;
  error?: string;
};

/** UI citation chips only need metadata, not full chunk text. */
export function toUiCitedDocument(document: CitedDocument): CitedDocument {
  return {
    blurb: document.blurb,
    content: "",
    document: document.document,
    documentId: document.documentId,
    link: document.link,
    sourceConnectorType: document.sourceConnectorType,
    sourceType: document.sourceType,
    title: document.title,
    updatedAt: document.updatedAt,
  };
}

function toUiSearchResult(result: SearchResultChunk): SearchResultChunk {
  return {
    blurb: result.blurb,
    chunkIndex: result.chunkIndex,
    content: "",
    documentId: result.documentId,
    link: result.link,
    score: result.score,
    sourceConnectorType: result.sourceConnectorType,
    sourceType: result.sourceType,
    title: result.title,
    updatedAt: result.updatedAt,
  };
}

function toUiSteps(steps: InternalSearchStep[]): InternalSearchStep[] {
  return steps.map((step) => {
    if (step.type !== "reading") {
      return step;
    }
    return {
      results: step.results.map(toUiSearchResult),
      type: "reading",
    };
  });
}

/** Full tool output for UI persistence; omits chunk text duplicated in contextForLlm. */
export function toInternalSearchUiOutput(
  result: InternalSearchOutput
): InternalSearchToolOutput {
  return {
    citationMap: result.citationMap,
    documents: result.documents.map(toUiCitedDocument),
    steps: toUiSteps(result.steps),
    ...(result.error ? { error: result.error } : {}),
  };
}

export function toInternalSearchModelText(result: InternalSearchOutput) {
  const text = result.contextForLlm ?? "";
  if (/vespa|docker compose|embedding model server|ECONNREFUSED/i.test(text)) {
    return "Workspace search is temporarily unavailable. If you are in a knowledge base, search its indexed files instead.";
  }
  if (result.error && /vespa|docker|ECONNREFUSED/i.test(result.error)) {
    return "Workspace search is temporarily unavailable. If you are in a knowledge base, search its indexed files instead.";
  }
  return text;
}
