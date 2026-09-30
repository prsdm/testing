import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SearchResultChunk } from "@/shared/search/types";
import { buildJiraTextSearchJql } from "./jira-jql";
import { mergeHybridSearchResults } from "./merge";
import {
  documentQueryOverlap,
  extractQueryOverlapTokens,
  rerankByQueryOverlap,
} from "./query-overlap";

function chunk(args: {
  documentId: string;
  sourceType: SearchResultChunk["sourceType"];
  score: number;
  title?: string;
  content?: string;
}): SearchResultChunk {
  const title = args.title ?? args.documentId;
  const content = args.content ?? args.documentId;
  return {
    blurb: content.slice(0, 240),
    chunkIndex: 0,
    content,
    documentId: args.documentId,
    link: "",
    score: args.score,
    sourceType: args.sourceType,
    title,
  };
}

describe("buildJiraTextSearchJql", () => {
  it("escapes quotes and builds text search from live tokens", () => {
    assert.equal(
      buildJiraTextSearchJql('login "bug"'),
      'text ~ "login bug" ORDER BY updated DESC'
    );
  });

  it("strips conversation filler before JQL", () => {
    assert.equal(
      buildJiraTextSearchJql("conversation with Prasad so far"),
      'text ~ "prasad" ORDER BY updated DESC'
    );
  });
});

describe("query overlap rerank", () => {
  it("extracts content tokens and drops stopwords", () => {
    assert.deepEqual(extractQueryOverlapTokens("What is Shubham working on?"), [
      "shubham",
      "working",
    ]);
  });

  it("scores title hits higher than body hits", () => {
    const titleHit = documentQueryOverlap(["shubham"], {
      blurb: "",
      content: "misc",
      title: "Shubham Task",
    });
    const bodyHit = documentQueryOverlap(["shubham"], {
      blurb: "",
      content: "notes about shubham later",
      title: "Next JS",
    });
    assert.ok(titleHit > bodyHit);
  });

  it("promotes query-matching slack over unrelated kb", () => {
    const reranked = rerankByQueryOverlap({
      query: "what is shubham working on",
      results: [
        chunk({
          content: "Getting Started Prerequisites JavaScript web development",
          documentId: "next-js",
          score: 1,
          sourceType: "team_source",
          title: "Next JS",
        }),
        chunk({
          content:
            "Hi Shubham — here are your current tasks: Use cases by role",
          documentId: "slack-tasks",
          score: 0.99,
          sourceType: "slack",
          title: "admin",
        }),
      ],
    });

    assert.equal(reranked[0]?.documentId, "slack-tasks");
    assert.equal(reranked[1]?.documentId, "next-js");
  });
});

describe("mergeHybridSearchResults", () => {
  it("returns empty when all lists empty", () => {
    assert.deepEqual(
      mergeHybridSearchResults({
        jiraResults: [],
        kbResults: [],
        slackResults: [],
      }),
      []
    );
  });

  it("returns single list without requiring RRF", () => {
    const kb = [
      chunk({ documentId: "kb-1", score: 2, sourceType: "team_source" }),
      chunk({ documentId: "kb-2", score: 1, sourceType: "team_source" }),
    ];
    const merged = mergeHybridSearchResults({ kbResults: kb });
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.documentId, "kb-1");
  });

  it("reranks after RRF using the query", () => {
    const merged = mergeHybridSearchResults({
      kbResults: [
        chunk({
          content: "JavaScript web development concepts",
          documentId: "next-js",
          score: 1,
          sourceType: "team_source",
          title: "Next JS",
        }),
        chunk({
          content: "add sitemap done",
          documentId: "shubham-notion",
          score: 0.5,
          sourceType: "team_source",
          title: "Shubham Task",
        }),
      ],
      limit: 5,
      query: "what is shubham working on",
      slackResults: [
        chunk({
          content: "Hi Shubham — here are your current tasks",
          documentId: "slack-1",
          score: 1,
          sourceType: "slack",
          title: "admin",
        }),
      ],
    });

    assert.equal(merged[0]?.documentId, "shubham-notion");
    assert.equal(merged[1]?.documentId, "slack-1");
    assert.ok(merged.at(-1)?.documentId === "next-js");
  });

  it("dedupes indexed and live Slack by documentId, preferring live text", () => {
    const docId = "slack:C1:1710000000.000100";
    const merged = mergeHybridSearchResults({
      kbResults: [],
      limit: 5,
      slackIndexedResults: [
        chunk({
          content: "indexed older text",
          documentId: docId,
          score: 0.9,
          sourceType: "slack",
          title: "#pricing",
        }),
        chunk({
          content: "indexed only history",
          documentId: "slack:C1:1700000000.000100",
          score: 0.8,
          sourceType: "slack",
          title: "#pricing",
        }),
      ],
      slackResults: [
        chunk({
          content: "live fresher text",
          documentId: docId,
          score: 1,
          sourceType: "slack",
          title: "#pricing",
        }),
      ],
    });

    const sameId = merged.filter((item) => item.documentId === docId);
    assert.equal(sameId.length, 1);
    assert.equal(sameId[0]?.content, "live fresher text");
    assert.ok(
      merged.some((item) => item.documentId === "slack:C1:1700000000.000100")
    );
  });

  it("reserves slots per source so gmail cannot fill the whole window", () => {
    const merged = mergeHybridSearchResults({
      gmailResults: Array.from({ length: 12 }, (_, index) =>
        chunk({
          content: `prasad thread ${index}`,
          documentId: `gmail-${index}`,
          score: 1 - index * 0.01,
          sourceType: "gmail",
          title: `Prasad email ${index}`,
        })
      ),
      kbResults: [],
      limit: 6,
      query: "prasad",
      slackResults: [
        chunk({
          content: "Participant: Prasad · hey there",
          documentId: "slack-dm-1",
          score: 1,
          sourceType: "slack",
          title: "Prasad",
        }),
        chunk({
          content: "Participant: Prasad · status update",
          documentId: "slack-dm-2",
          score: 0.9,
          sourceType: "slack",
          title: "Prasad",
        }),
      ],
    });

    const slackCount = merged.filter(
      (item) => item.sourceType === "slack"
    ).length;
    const gmailCount = merged.filter(
      (item) => item.sourceType === "gmail"
    ).length;
    assert.ok(slackCount >= 2);
    assert.ok(gmailCount >= 2);
    assert.equal(merged.length, 6);
  });
});
