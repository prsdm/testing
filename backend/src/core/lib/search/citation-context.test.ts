import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CitedDocument } from "@/shared/search/citations";
import { stabilizeCitedDocuments, webDocumentId } from "./citation-context";

const webDoc = (url: string, title: string): CitedDocument => ({
  blurb: "Snippet text",
  content: "Snippet text",
  document: 0,
  documentId: webDocumentId(url),
  link: url,
  sourceType: "web",
  title,
});

describe("stabilizeCitedDocuments", () => {
  it("assigns stable citation numbers across calls", () => {
    const context = {
      citationNumberByDocumentId: new Map<string, number>(),
      nextCitationNumber: 1,
    };

    const first = stabilizeCitedDocuments(
      [webDoc("https://example.com/a", "A")],
      context
    );
    const second = stabilizeCitedDocuments(
      [webDoc("https://example.com/b", "B")],
      context
    );

    assert.equal(first.documents[0]?.document, 1);
    assert.equal(second.documents[0]?.document, 2);
    assert.match(first.contextForLlm, /document: 1/);
    assert.match(second.contextForLlm, /Remember to provide inline citations/);
  });

  it("reuses citation numbers for the same document id", () => {
    const context = {
      citationNumberByDocumentId: new Map<string, number>(),
      nextCitationNumber: 1,
    };

    const first = stabilizeCitedDocuments(
      [webDoc("https://example.com/a", "A")],
      context
    );
    const second = stabilizeCitedDocuments(
      [
        {
          ...webDoc("https://example.com/a", "A full"),
          content: "Full page text",
        },
      ],
      context
    );

    assert.equal(first.documents[0]?.document, 1);
    assert.equal(second.documents[0]?.document, 1);
    assert.equal(context.nextCitationNumber, 2);
  });
});
