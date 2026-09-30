import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { InternalSearchOutput } from "@/core/lib/search/internal-search";
import {
  toInternalSearchModelText,
  toInternalSearchUiOutput,
  toUiCitedDocument,
} from "./internal-search-output";

const sampleResult: InternalSearchOutput = {
  citationMap: { 1: "doc-a" },
  contextForLlm:
    "document: 1\ntitle: GCP Guide\ncontent: Long chunk text that should not reach the UI payload.",
  documents: [
    {
      blurb: "Long blurb",
      content: "Long chunk text that should not reach the UI payload.",
      document: 1,
      documentId: "doc-a",
      link: "https://example.com/a",
      sourceType: "google_drive",
      title: "GCP Guide",
    },
  ],
  steps: [
    { queries: ["gcp guidelines"], type: "queries" },
    {
      results: [
        {
          blurb: "Long blurb",
          chunkIndex: 0,
          content: "Long chunk text that should not reach the UI payload.",
          documentId: "doc-a",
          link: "https://example.com/a",
          score: 1,
          sourceType: "google_drive",
          title: "GCP Guide",
        },
      ],
      type: "reading",
    },
    { type: "done" },
  ],
};

describe("toInternalSearchUiOutput", () => {
  it("strips chunk text from UI payload", () => {
    const uiOutput = toInternalSearchUiOutput(sampleResult);
    const readingStep = uiOutput.steps?.[1] as
      | {
          type: "reading";
          results: Array<{ content?: string; blurb?: string }>;
        }
      | undefined;

    assert.equal(uiOutput.documents?.[0]?.content, "");
    assert.equal(uiOutput.documents?.[0]?.blurb, "Long blurb");
    assert.equal(
      readingStep?.type === "reading" && readingStep.results[0]?.content,
      ""
    );
    assert.equal(
      readingStep?.type === "reading" && readingStep.results[0]?.blurb,
      "Long blurb"
    );
    assert.equal(uiOutput.contextForLlm, undefined);
    assert.equal(uiOutput.citationMap?.[1], "doc-a");
  });
});

describe("toInternalSearchModelText", () => {
  it("keeps full context for the model", () => {
    assert.match(toInternalSearchModelText(sampleResult), /document: 1/);
  });
});

describe("toUiCitedDocument", () => {
  it("preserves citation metadata", () => {
    const [document] = sampleResult.documents;
    assert.ok(document);
    const uiDoc = toUiCitedDocument(document);
    assert.equal(uiDoc.document, 1);
    assert.equal(uiDoc.title, "GCP Guide");
    assert.equal(uiDoc.content, "");
    assert.equal(uiDoc.blurb, "Long blurb");
  });
});
