import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKnowledgeBaseSearchQueries,
  isLikelyFollowUpQuery,
} from "./expand-knowledge-base-search-query";

describe("isLikelyFollowUpQuery", () => {
  it("treats short questions as follow-ups", () => {
    assert.equal(isLikelyFollowUpQuery("how many years experience?"), true);
  });

  it("treats standalone questions as non follow-ups", () => {
    assert.equal(
      isLikelyFollowUpQuery(
        "Summarize the technical skills listed on the uploaded resume and group them by category"
      ),
      false
    );
  });
});

describe("buildKnowledgeBaseSearchQueries", () => {
  it("returns only the current query when there is no history", () => {
    const queries = buildKnowledgeBaseSearchQueries({
      currentQuery: "what skills are on the resume",
    });
    assert.deepEqual(queries, ["what skills are on the resume"]);
  });

  it("adds history-aware queries for follow-ups", () => {
    const queries = buildKnowledgeBaseSearchQueries({
      chatHistory: [
        { content: "what skills are on the resume", role: "user" },
        {
          content: "The resume lists JavaScript, React, and Node.js.",
          role: "assistant",
        },
      ],
      currentQuery: "how many years experience?",
    });

    assert.equal(queries[0], "how many years experience?");
    assert.ok(
      queries.some((query) => query.includes("what skills are on the resume"))
    );
    assert.ok(
      queries.some((query) => query.includes("how many years experience?"))
    );
  });
});
