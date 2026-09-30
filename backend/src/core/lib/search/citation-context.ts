import {
  buildCitationContextForDocuments,
  type CitationMap,
  type CitedDocument,
} from "@/shared/search/citations";

export type SharedCitationContext = {
  nextCitationNumber: number;
  citationNumberByDocumentId: Map<string, number>;
};

export function createSharedCitationContext(): SharedCitationContext {
  return {
    citationNumberByDocumentId: new Map(),
    nextCitationNumber: 1,
  };
}

export function webDocumentId(url: string) {
  return `web:${url}`;
}

export function stabilizeCitedDocuments(
  documents: CitedDocument[],
  context: SharedCitationContext | undefined,
  emptyContextMessage = "No results found."
): {
  documents: CitedDocument[];
  citationMap: CitationMap;
  contextForLlm: string;
} {
  if (documents.length === 0) {
    return {
      citationMap: {},
      contextForLlm: emptyContextMessage,
      documents: [],
    };
  }

  const remapped = context
    ? documents.map((document) => {
        const existing = context.citationNumberByDocumentId.get(
          document.documentId
        );
        if (existing !== undefined) {
          return { ...document, document: existing };
        }

        const assigned = context.nextCitationNumber;
        context.nextCitationNumber += 1;
        context.citationNumberByDocumentId.set(document.documentId, assigned);
        return { ...document, document: assigned };
      })
    : documents.map((document, index) => ({
        ...document,
        document: index + 1,
      }));

  const citationMap: CitationMap = {};
  for (const document of remapped) {
    citationMap[document.document] = document.documentId;
  }

  return {
    citationMap,
    contextForLlm: buildCitationContextForDocuments(remapped),
    documents: remapped,
  };
}
