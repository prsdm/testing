import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSharedCitationContext } from "@/core/lib/search/citation-context";
import type { SearchResultChunk } from "@/shared/search/types";
import {
  buildKnowledgeBaseSearchCitedContext,
  mergeKnowledgeBaseSourceChunks,
} from "./build-knowledge-base-search-context";

function chunk(
  documentId: string,
  chunkIndex: number,
  content: string,
  score: number
): SearchResultChunk {
  return {
    blurb: content.slice(0, 240),
    chunkIndex,
    content,
    documentId,
    link: "",
    score,
    sourceType: "team_source",
    title: "Job description",
  };
}

describe("mergeKnowledgeBaseSourceChunks", () => {
  it("joins all chunks for a source in order", () => {
    const merged = mergeKnowledgeBaseSourceChunks([
      chunk("doc-a", 1, "Requirements section.", 1),
      chunk("doc-a", 0, "Opening responsibilities.", 2),
      chunk("doc-a", 2, "Benefits section.", 1),
    ]);

    assert.equal(
      merged?.content,
      "Opening responsibilities.\n\nRequirements section.\n\nBenefits section."
    );
  });
});

describe("buildKnowledgeBaseSearchCitedContext", () => {
  it("feeds merged full-document text instead of one search hit", () => {
    const searchHits = [
      chunk("doc-a", 0, "Opening responsibilities.", 3),
      chunk("doc-a", 2, "Benefits section.", 1),
    ];
    const documentsBySourceId = new Map<string, SearchResultChunk[]>([
      [
        "doc-a",
        [
          chunk("doc-a", 0, "Opening responsibilities.", 0),
          chunk("doc-a", 1, "Requirements section.", 0),
          chunk("doc-a", 2, "Benefits section.", 0),
        ],
      ],
    ]);

    const { documents, contextForLlm } = buildKnowledgeBaseSearchCitedContext({
      documentsBySourceId,
      searchHits,
    });

    assert.equal(documents.length, 1);
    assert.match(documents[0]?.content ?? "", /Requirements section\./);
    assert.match(documents[0]?.content ?? "", /Benefits section\./);
    assert.match(contextForLlm, /Requirements section\./);
  });

  it("assigns stable citation numbers across knowledge base searches", () => {
    const citationContext = createSharedCitationContext();

    const first = buildKnowledgeBaseSearchCitedContext({
      citationContext,
      documentsBySourceId: new Map([
        [
          "job-description",
          [chunk("job-description", 0, "Job requirements", 0)],
        ],
      ]),
      searchHits: [chunk("job-description", 0, "Job requirements", 2)],
    });
    const second = buildKnowledgeBaseSearchCitedContext({
      citationContext,
      documentsBySourceId: new Map([
        ["resume", [chunk("resume", 0, "Resume", 0)]],
      ]),
      searchHits: [chunk("resume", 0, "Resume", 2)],
    });

    assert.equal(first.documents[0]?.document, 1);
    assert.equal(second.documents[0]?.document, 2);
  });
});
