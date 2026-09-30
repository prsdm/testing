import assert from "node:assert/strict";
import test from "node:test";
import {
  formatSearchQueryChip,
  resolveSearchDisplayQueries,
  resolveSearchStepSummary,
  sanitizeSearchOutputForDisplay,
  searchToolHasExpandableBody,
  unwrapSearchToolResultOutput,
} from "./search-tool-display";

test("resolveSearchDisplayQueries prefers input while search is pending", () => {
  assert.deepEqual(
    resolveSearchDisplayQueries(
      { knowledgeBaseScope: true, query: "earnings flash report" },
      undefined
    ),
    ["earnings flash report"]
  );
});

test("sanitizeSearchOutputForDisplay strips contextForLlm from results JSON", () => {
  const sanitized = sanitizeSearchOutputForDisplay({
    citationMap: {},
    contextForLlm: "very long passage text",
    documents: [{ documentId: "doc-1", title: "Report" }],
    steps: [{ type: "done" }],
  });

  assert.deepEqual(sanitized, {
    citationMap: {},
    documents: [{ documentId: "doc-1", title: "Report" }],
    steps: [{ type: "done" }],
  });
});

test("formatSearchQueryChip summarizes one or many queries", () => {
  assert.equal(formatSearchQueryChip([]), undefined);
  assert.equal(formatSearchQueryChip([" earnings "]), "earnings");
  assert.equal(
    formatSearchQueryChip(["earnings flash report", "Q2 guidance"]),
    "earnings flash report, Q2 guidance"
  );
  assert.equal(formatSearchQueryChip(["a", "b", "c"]), "a, b +1");
});

test("resolveSearchStepSummary returns title without search/result counts", () => {
  assert.deepEqual(
    resolveSearchStepSummary({
      input: {
        knowledgeBaseName: "Finance",
        knowledgeBaseScope: true,
        query: "earnings flash report",
      },
      isKnowledgeBaseScope: true,
      isPending: false,
      output: {
        citationMap: {},
        documents: [{ documentId: "doc-1" }],
        steps: [{ queries: ["earnings flash report"], type: "queries" }],
      },
      variant: "knowledge",
    }),
    {
      isPendingLabel: false,
      pendingLabel: "Searching knowledge base…",
      title: "Searched knowledge base",
    }
  );
});

test("resolveSearchStepSummary keeps pending shimmer label", () => {
  assert.deepEqual(
    resolveSearchStepSummary({
      input: {
        knowledgeBaseName: "Finance",
        knowledgeBaseScope: true,
        query: "earnings flash report",
      },
      isKnowledgeBaseScope: true,
      isPending: true,
      variant: "knowledge",
    }),
    {
      isPendingLabel: true,
      pendingLabel: "Searching knowledge base…",
      title: "Searching knowledge base…",
    }
  );
});

test("resolveSearchStepSummary labels interrupted searches as stopped", () => {
  assert.deepEqual(
    resolveSearchStepSummary({
      input: { query: "agent harness" },
      isInterrupted: true,
      isPending: false,
      variant: "web",
    }),
    {
      isPendingLabel: false,
      pendingLabel: "Searching web",
      title: "Search stopped",
    }
  );
});

test("searchToolHasExpandableBody is true when input or output exists", () => {
  assert.equal(
    searchToolHasExpandableBody({
      input: { query: "earnings" },
      isPending: false,
    }),
    true
  );
  assert.equal(
    searchToolHasExpandableBody({
      isPending: false,
      output: { documents: [] },
    }),
    true
  );
  assert.equal(
    searchToolHasExpandableBody({
      isPending: true,
      output: { documents: [] },
    }),
    false
  );
});

test("unwrapSearchToolResultOutput reads nested tool payloads", () => {
  assert.deepEqual(
    unwrapSearchToolResultOutput({
      contextForLlm: "hidden",
      input: { query: "agent harness" },
      output: { query: "agent harness", results: [] },
    }),
    { query: "agent harness", results: [] }
  );
});
