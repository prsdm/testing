import assert from "node:assert/strict";
import test from "node:test";
import { KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG } from "@/shared/knowledge-bases/knowledge-base-search-scope";
import {
  buildWorkflowToolPartFromCall,
  buildWorkflowToolPartFromResult,
  keepLatestPreToolText,
  normalizeChatMessageParts,
  normalizeStoredToolPart,
} from "./workflow-tool-parts";

test("maps knowledgeBaseSearch tool calls to sourceSearch UI parts", () => {
  const pending = buildWorkflowToolPartFromCall({
    toolArgs: { query: "earnings flash report" },
    toolCallId: "search-1",
    toolName: "knowledgeBaseSearch",
  });

  assert.equal(pending?.type, "tool-sourceSearch");
  assert.equal(
    pending &&
      "input" in pending &&
      typeof pending.input === "object" &&
      pending.input !== null
      ? (pending.input as Record<string, unknown>)[
          KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG
        ]
      : undefined,
    true
  );

  const completed = buildWorkflowToolPartFromResult({
    result: {
      input: {
        knowledgeBaseName: "Finance",
        knowledgeBaseScope: true,
        query: "earnings flash report",
      },
      output: {
        citationMap: { 1: 1 },
        documents: [{ content: "Revenue up", document: 1, title: "Earnings" }],
        steps: [{ queries: ["earnings flash report"], type: "queries" }],
      },
    },
    toolArgs: { query: "earnings flash report" },
    toolCallId: "search-1",
    toolName: "knowledgeBaseSearch",
  });

  assert.equal(completed?.type, "tool-sourceSearch");
  assert.equal(
    completed && "state" in completed ? completed.state : undefined,
    "output-available"
  );
  assert.equal(
    completed &&
      "input" in completed &&
      completed.input &&
      typeof completed.input === "object"
      ? (completed.input as Record<string, unknown>).knowledgeBaseName
      : undefined,
    "Finance"
  );
});

test("buildWorkflowToolPartFromResult rebuilds sourceSearch UI parts on rerun", () => {
  const completed = buildWorkflowToolPartFromResult({
    result: {
      input: {
        query: "earnings flash report",
        [KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG]: true,
        knowledgeBaseName: "Finance",
      },
      output: {
        citationMap: { 1: 1 },
        documents: [{ content: "Revenue up", document: 1, title: "Earnings" }],
        steps: [{ queries: ["earnings flash report"], type: "queries" }],
      },
    },
    toolArgs: {
      query: "earnings flash report",
      [KNOWLEDGE_BASE_SEARCH_TOOL_INPUT_FLAG]: true,
      knowledgeBaseName: "Finance",
    },
    toolCallId: "search-1",
    toolName: "sourceSearch",
  });

  assert.equal(completed?.type, "tool-sourceSearch");
  assert.equal(
    completed && "state" in completed ? completed.state : undefined,
    "output-available"
  );
});

test("normalizes legacy stored knowledgeBaseSearch parts on read", () => {
  const normalized = normalizeStoredToolPart({
    input: { query: "roadmap" },
    output: {
      input: { knowledgeBaseScope: true, query: "roadmap" },
      output: {
        citationMap: {},
        documents: [],
        steps: [{ type: "done" }],
      },
    },
    state: "output-available",
    toolCallId: "search-1",
    type: "tool-knowledgeBaseSearch",
  });

  assert.equal(normalized.type, "tool-sourceSearch");
});

test("normalizeChatMessageParts drops duplicate commentary text parts", () => {
  const parts = normalizeChatMessageParts([
    { text: "Searching the knowledge base.", type: "text" },
    {
      input: { query: "roadmap" },
      state: "output-available",
      toolCallId: "one",
      type: "tool-sourceSearch",
    },
    { text: "Searching the knowledge base.", type: "text" },
    { text: "Found the report.", type: "text" },
  ]);

  assert.deepEqual(
    parts
      .filter((part) => part.type === "text")
      .map((part) => ("text" in part ? part.text : "")),
    ["Searching the knowledge base.", "Found the report."]
  );
});

test("normalizeChatMessageParts keeps duplicate tools at their first position", () => {
  const search = {
    input: { query: "earnings flash report" },
    output: { documents: [] },
    state: "output-available" as const,
    toolCallId: "search-1",
    type: "tool-sourceSearch" as const,
  };
  const parts = normalizeChatMessageParts([
    { text: "Searching the knowledge base.", type: "text" },
    search,
    { text: "The summary was saved to Drive.", type: "text" },
    search,
  ]);

  assert.deepEqual(
    parts.map((part) => part.type),
    ["text", "tool-sourceSearch", "text"]
  );
  assert.equal(
    parts.filter(
      (part) => "toolCallId" in part && part.toolCallId === "search-1"
    ).length,
    1
  );
});

test("normalizeChatMessageParts moves trailing Thought before final text", () => {
  const parts = normalizeChatMessageParts([
    {
      input: { name: "summary.doc" },
      output: { id: "file-1" },
      state: "output-available",
      toolCallId: "drive-1",
      type: "tool-driveUploadFile",
    },
    { text: "The summary document was created.", type: "text" },
    {
      state: "done",
      text: "Finalizing report details.",
      type: "reasoning",
    },
  ]);

  assert.deepEqual(
    parts.map((part) => part.type),
    ["tool-driveUploadFile", "reasoning", "text"]
  );
});

test("normalizeChatMessageParts coalesces consecutive reasoning snapshots", () => {
  const parts = normalizeChatMessageParts([
    {
      state: "streaming",
      text: 'Creating a file, using "sample.txt" with sample content.',
      type: "reasoning",
    },
    {
      state: "done",
      text: 'Creating a file , using " sample.txt " with sample content .',
      type: "reasoning",
    },
    { text: "I'll create sample.txt.", type: "text" },
  ]);

  assert.deepEqual(
    parts.map((part) => part.type),
    ["reasoning", "text"]
  );
  assert.equal(
    parts[0]?.type === "reasoning" ? parts[0].text : undefined,
    'Creating a file, using "sample.txt" with sample content.'
  );
});

test("keepLatestPreToolText keeps one pre-tool commentary line", () => {
  const parts = keepLatestPreToolText([
    {
      text: "I'm creating `sample.txt` in your Google Drive with a short sample line of text.",
      type: "text",
    },
    {
      text: "I'll create `sample.txt` in the root of your Google Drive with sample text.",
      type: "text",
    },
    {
      text: "I'm creating `sample.txt` in the root of your Google Drive with sample text.",
      type: "text",
    },
    {
      input: { name: "sample.txt" },
      state: "approval-requested",
      toolCallId: "drive-1",
      type: "tool-driveUploadFile",
    },
  ]);

  assert.deepEqual(
    parts.map((part) => part.type),
    ["text", "tool-driveUploadFile"]
  );
  assert.equal(
    parts[0]?.type === "text" ? parts[0].text : undefined,
    "I'm creating `sample.txt` in the root of your Google Drive with sample text."
  );
});

test("normalizeChatMessageParts coalesces duplicate pre-tool text", () => {
  const parts = normalizeChatMessageParts([
    {
      text: "I'm creating `sample.txt` in your Google Drive with a short sample line of text.",
      type: "text",
    },
    {
      text: "I'll create `sample.txt` in the root of your Google Drive with sample text.",
      type: "text",
    },
    {
      input: { name: "sample.txt" },
      state: "approval-requested",
      toolCallId: "drive-1",
      type: "tool-driveUploadFile",
    },
  ]);

  assert.deepEqual(
    parts.map((part) => part.type),
    ["text", "tool-driveUploadFile"]
  );
  assert.equal(parts.filter((part) => part.type === "text").length, 1);
});
