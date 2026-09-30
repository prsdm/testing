import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCitedDocumentsFromResults,
  collectCitationsFromMessageParts,
  linkifyInlineCitations,
} from "./citations";
import type { SearchResultChunk } from "./types";

const sampleResults: SearchResultChunk[] = [
  {
    blurb: "Revenue grew 10%.",
    chunkIndex: 0,
    content: "Revenue grew 10%.",
    documentId: "doc-a",
    link: "https://example.com/a",
    score: 2,
    sourceType: "google_drive",
    title: "Earnings Flash",
  },
  {
    blurb: "Vacation policy details.",
    chunkIndex: 0,
    content: "Vacation policy details.",
    documentId: "doc-b",
    link: "https://example.com/b",
    score: 1,
    sourceType: "google_drive",
    title: "Policy Guide",
  },
];

describe("buildCitedDocumentsFromResults", () => {
  it("numbers documents from citationStartNumber", () => {
    const { documents, citationMap, contextForLlm } =
      buildCitedDocumentsFromResults(sampleResults, 4);

    assert.equal(documents.length, 2);
    assert.equal(documents[0]?.document, 4);
    assert.equal(documents[1]?.document, 5);
    assert.equal(citationMap[4], "doc-a");
    assert.equal(citationMap[5], "doc-b");
    assert.match(contextForLlm, /document: 4/);
    assert.match(contextForLlm, /Remember to provide inline citations/);
  });

  it("deduplicates by document id keeping highest score", () => {
    const [firstResult] = sampleResults;
    assert.ok(firstResult);
    const duplicateResults: SearchResultChunk[] = [
      ...sampleResults,
      {
        ...firstResult,
        chunkIndex: 1,
        content: "Lower score chunk",
        score: 0.5,
      },
    ];

    const { documents } = buildCitedDocumentsFromResults(duplicateResults);
    assert.equal(documents.length, 2);
    assert.equal(documents[0]?.documentId, "doc-a");
    assert.equal(documents[0]?.content, "Revenue grew 10%.");
  });
});

describe("collectCitationsFromMessageParts", () => {
  it("collects citations from multiple searches without overwriting", () => {
    const parts = [
      {
        input: { query: "first search" },
        output: {
          documents: [
            {
              content: "A",
              document: 1,
              documentId: "doc-a",
              link: "https://example.com/a",
              sourceType: "google_drive" as const,
              title: "A",
            },
          ],
        },
        state: "output-available" as const,
        toolCallId: "call-1",
        type: "tool-sourceSearch" as const,
      },
      {
        input: { query: "second search" },
        output: {
          documents: [
            {
              content: "B",
              document: 2,
              documentId: "doc-b",
              link: "https://example.com/b",
              sourceType: "google_drive" as const,
              title: "B",
            },
          ],
        },
        state: "output-available" as const,
        toolCallId: "call-2",
        type: "tool-sourceSearch" as const,
      },
    ];

    const citations = collectCitationsFromMessageParts(parts);
    assert.equal(citations[1]?.documentId, "doc-a");
    assert.equal(citations[2]?.documentId, "doc-b");
  });

  it("keeps the first document when duplicate citation numbers collide", () => {
    const parts = [
      {
        input: { query: "job requirements" },
        output: {
          documents: [
            {
              content: "",
              document: 1,
              documentId: "job-description",
              link: "",
              sourceType: "team_source" as const,
              title: "Founding ML Engineer",
            },
          ],
        },
        state: "output-available" as const,
        toolCallId: "call-1",
        type: "tool-sourceSearch" as const,
      },
      {
        input: { query: "resume" },
        output: {
          documents: [
            {
              content: "",
              document: 1,
              documentId: "resume",
              link: "",
              sourceType: "team_source" as const,
              title: "Prasad Mahamulkar",
            },
          ],
        },
        state: "output-available" as const,
        toolCallId: "call-2",
        type: "tool-sourceSearch" as const,
      },
    ];

    const citations = collectCitationsFromMessageParts(parts);
    assert.equal(citations[1]?.documentId, "job-description");
    assert.equal(citations[2], undefined);
  });

  it("collects citations from web search tool parts", () => {
    const parts = [
      {
        input: { queries: ["anthropic news"] },
        output: {
          documents: [
            {
              blurb: "Latest updates",
              content: "",
              document: 1,
              documentId: "web:https://example.com/news",
              link: "https://example.com/news",
              sourceType: "web" as const,
              title: "Anthropic News",
            },
          ],
          queries: ["anthropic news"],
          results: [],
        },
        state: "output-available" as const,
        toolCallId: "call-web",
        type: "tool-webSearch" as const,
      },
    ];

    const citations = collectCitationsFromMessageParts(parts);
    assert.equal(citations[1]?.title, "Anthropic News");
    assert.equal(citations[1]?.sourceType, "web");
  });
});

describe("linkifyInlineCitations", () => {
  const twoCitations = {
    1: {
      content: "A",
      document: 1,
      documentId: "doc-a",
      link: "https://example.com/a",
      sourceType: "google_drive" as const,
      title: "A",
    },
    2: {
      content: "B",
      document: 2,
      documentId: "doc-b",
      link: "https://example.com/b",
      sourceType: "google_drive" as const,
      title: "B",
    },
  };

  it("turns inline citation markers into links", () => {
    const linked = linkifyInlineCitations(
      "See finding [1] here.",
      twoCitations
    );
    assert.equal(linked, "See finding here. [1](https://example.com/a)");
  });

  it("uses placeholder links for citations without urls", () => {
    const citations = {
      4: {
        content: "Indexed 3 row(s)",
        document: 4,
        documentId: "db-parent",
        link: "",
        sourceConnectorType: "notion" as const,
        sourceType: "team_source" as const,
        title: "Bug Tracker (database)",
      },
    };

    const linked = linkifyInlineCitations("Database summary [4].", citations);
    assert.equal(linked, "Database summary. [4](#cite-4)");
  });

  it("moves citations after sentence punctuation", () => {
    assert.equal(
      linkifyInlineCitations("Revenue grew [1]. Costs fell [2].", twoCitations),
      "Revenue grew. [1](https://example.com/a) Costs fell. [2](https://example.com/b)"
    );

    assert.equal(
      linkifyInlineCitations("Both rose [1] [2].", twoCitations),
      "Both rose. [1](https://example.com/a) [2](https://example.com/b)"
    );

    assert.equal(
      linkifyInlineCitations(
        "another model named **Terra** [1] [2].",
        twoCitations
      ),
      "another model named **Terra**. [1](https://example.com/a) [2](https://example.com/b)"
    );

    assert.equal(
      linkifyInlineCitations(
        "reports with Bank of America (BofA) [1] [2].",
        twoCitations
      ),
      "reports with Bank of America (BofA). [1](https://example.com/a) [2](https://example.com/b)"
    );

    assert.equal(
      linkifyInlineCitations(
        "reports with Bank of America [BofA] [1] [2].",
        twoCitations
      ),
      "reports with Bank of America [BofA]. [1](https://example.com/a) [2](https://example.com/b)"
    );
  });

  it("moves mid-sentence citations to the end of the sentence", () => {
    assert.equal(
      linkifyInlineCitations("Revenue grew [1] this quarter.", twoCitations),
      "Revenue grew this quarter. [1](https://example.com/a)"
    );

    assert.equal(
      linkifyInlineCitations(
        "- **Revenue:** [1] Represents the total income from sales.",
        twoCitations
      ),
      "- **Revenue:** Represents the total income from sales. [1](https://example.com/a)"
    );

    assert.equal(
      linkifyInlineCitations(
        '1. [1] Prasad responded "Sure" to something you asked.',
        twoCitations
      ),
      '1. Prasad responded "Sure" to something you asked. [1](https://example.com/a)'
    );

    assert.equal(
      linkifyInlineCitations(
        "representing a [1] +20.1% year-over-year increase.",
        twoCitations
      ),
      "representing a +20.1% year-over-year increase. [1](https://example.com/a)"
    );

    assert.equal(
      linkifyInlineCitations("foo [1] bar [2] baz.", twoCitations),
      "foo bar baz. [1](https://example.com/a) [2](https://example.com/b)"
    );
  });

  it("leaves parenthetical and already-trailing citations alone", () => {
    assert.equal(
      linkifyInlineCitations(
        "See the appendix (doc [1]) for details.",
        twoCitations
      ),
      "See the appendix (doc [1](https://example.com/a)) for details."
    );

    assert.equal(
      linkifyInlineCitations(
        "Already trailing. [1] Next sentence.",
        twoCitations
      ),
      "Already trailing. [1](https://example.com/a) Next sentence."
    );

    assert.equal(
      linkifyInlineCitations("Glued period.[1]Next sentence.", twoCitations),
      "Glued period. [1](https://example.com/a) Next sentence."
    );
  });

  it("sanitizes malformed citation markers before linkifying", () => {
    const linked = linkifyInlineCitations(
      "Messy cites: 【1】 [[2]] [1, 2] [2] [2].",
      twoCitations
    );

    assert.equal(
      linked,
      "Messy cites:. [1](https://example.com/a) [2](https://example.com/b)"
    );
  });

  it("collapses duplicate citation pills after moving them to sentence end", () => {
    assert.equal(
      linkifyInlineCitations(
        "Models are available in tiers [1] (Sol, Terra, and Luna) [1]. These ship soon.",
        twoCitations
      ),
      "Models are available in tiers (Sol, Terra, and Luna). [1](https://example.com/a) These ship soon."
    );

    assert.equal(
      linkifyInlineCitations(
        "It feels more natural [1] [1] [1]. It uses low latency.",
        twoCitations
      ),
      "It feels more natural. [1](https://example.com/a) It uses low latency."
    );

    assert.equal(
      linkifyInlineCitations(
        "Fidji stepped down [1] [2] [1]. Additionally Greg returned.",
        twoCitations
      ),
      "Fidji stepped down. [1](https://example.com/a) [2](https://example.com/b) Additionally Greg returned."
    );
  });

  it("strips claim-wrapping brackets before citation markers", () => {
    assert.equal(
      linkifyInlineCitations(
        "[On Agents' Last Exam, GPT-5.6 Sol achieves 53.6][1]",
        twoCitations
      ),
      "On Agents' Last Exam, GPT-5.6 Sol achieves 53.6 [1](https://example.com/a)"
    );

    assert.equal(
      linkifyInlineCitations(
        "[Sol sets a new standard at lower cost].[1] Next sentence.",
        twoCitations
      ),
      "Sol sets a new standard at lower cost. [1](https://example.com/a) Next sentence."
    );

    assert.equal(
      linkifyInlineCitations(
        "reports with Bank of America [BofA] [1].",
        twoCitations
      ),
      "reports with Bank of America [BofA]. [1](https://example.com/a)"
    );
  });
});
