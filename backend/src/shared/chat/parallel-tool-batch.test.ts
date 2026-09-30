import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssistantRenderBlocks,
  getToolPartAggregateStatus,
  parallelToolBatchBoundsForToolCall,
} from "@/shared/chat/parallel-tool-batch";

test("parallelToolBatchBoundsForToolCall stops at commentary between tools", () => {
  const parts = [
    {
      input: { query: "a" },
      output: { query: "a", results: [] },
      state: "output-available" as const,
      toolCallId: "web-1",
      type: "tool-webSearch" as const,
    },
    { text: "Found one report.", type: "text" as const },
    {
      input: { query: "b" },
      output: { query: "b", results: [] },
      state: "output-available" as const,
      toolCallId: "web-2",
      type: "tool-webSearch" as const,
    },
  ];
  const bounds = parallelToolBatchBoundsForToolCall(parts, "web-1");
  assert.deepEqual(bounds, { end: 0, start: 0 });
});

test("buildAssistantRenderBlocks keeps different providers separate", () => {
  const parts = [
    { text: "Checking both.", type: "text" as const },
    {
      input: {},
      output: { results: [] },
      state: "output-available" as const,
      toolCallId: "gmail-1",
      type: "tool-gmailSearchMessages" as const,
    },
    {
      input: {},
      output: { results: [] },
      state: "output-available" as const,
      toolCallId: "slack-1",
      type: "tool-slackSearchMessages" as const,
    },
    { text: "Summary.", type: "text" as const },
  ];

  const blocks = buildAssistantRenderBlocks(parts);
  assert.deepEqual(blocks, [
    { kind: "part", partIndex: 0 },
    { kind: "part", partIndex: 1 },
    { kind: "part", partIndex: 2 },
    { kind: "part", partIndex: 3 },
  ]);
});

test("buildAssistantRenderBlocks groups contiguous same-provider connector tools", () => {
  const parts = [
    {
      input: {},
      output: { users: [{ id: "U1" }, { id: "U2" }] },
      state: "output-available" as const,
      toolCallId: "slack-users",
      type: "tool-slackListUsers" as const,
    },
    {
      input: { query: "earnings" },
      output: { results: [] },
      state: "output-available" as const,
      toolCallId: "slack-search",
      type: "tool-slackSearchMessages" as const,
    },
  ];

  const blocks = buildAssistantRenderBlocks(parts);
  assert.deepEqual(blocks, [
    {
      kind: "toolGroup",
      partIndices: [0, 1],
      provider: "slack",
    },
  ]);
});

test("buildAssistantRenderBlocks does not merge slack blocks interrupted by other providers", () => {
  const parts = [
    {
      input: {},
      output: { users: [] },
      state: "output-available" as const,
      toolCallId: "slack-users",
      type: "tool-slackListUsers" as const,
    },
    {
      input: {},
      output: { results: [] },
      state: "output-available" as const,
      toolCallId: "gmail-1",
      type: "tool-gmailSearchMessages" as const,
    },
    {
      input: { query: "earnings" },
      output: { query: "earnings", results: [] },
      state: "output-available" as const,
      toolCallId: "web-1",
      type: "tool-webSearch" as const,
    },
    {
      input: { channelId: "C1", text: "Done" },
      output: { ok: true },
      state: "output-available" as const,
      toolCallId: "slack-post",
      type: "tool-slackPostMessage" as const,
    },
  ];

  const blocks = buildAssistantRenderBlocks(parts);
  assert.deepEqual(blocks, [
    { kind: "part", partIndex: 0 },
    { kind: "part", partIndex: 1 },
    { kind: "part", partIndex: 2 },
    { kind: "part", partIndex: 3 },
  ]);
});

test("buildAssistantRenderBlocks keeps a lone connector tool as a single part", () => {
  const parts = [
    {
      input: { query: "a" },
      output: { results: [] },
      state: "output-available" as const,
      toolCallId: "slack-1",
      type: "tool-slackSearchMessages" as const,
    },
  ];

  const blocks = buildAssistantRenderBlocks(parts);
  assert.deepEqual(blocks, [{ kind: "part", partIndex: 0 }]);
});

test("buildAssistantRenderBlocks keeps approval-requested tools separate", () => {
  const parts = [
    {
      input: {},
      output: { results: [] },
      state: "output-available" as const,
      toolCallId: "gmail-1",
      type: "tool-gmailSearchMessages" as const,
    },
    {
      approval: { id: "approval-1" },
      input: { to: "a@example.com" },
      state: "approval-requested" as const,
      toolCallId: "gmail-send",
      type: "tool-gmailSendMessage" as const,
    },
  ];

  const blocks = buildAssistantRenderBlocks(parts);
  assert.deepEqual(blocks, [
    { kind: "part", partIndex: 0 },
    { kind: "part", partIndex: 1 },
  ]);
});

test("buildAssistantRenderBlocks keeps a lone tool as a single part", () => {
  const parts = [
    {
      input: { query: "a" },
      output: { query: "a", results: [] },
      state: "output-available" as const,
      toolCallId: "web-1",
      type: "tool-webSearch" as const,
    },
  ];

  const blocks = buildAssistantRenderBlocks(parts);
  assert.deepEqual(blocks, [{ kind: "part", partIndex: 0 }]);
});

test("getToolPartAggregateStatus ignores in-flight tools after streaming stops", () => {
  const part = {
    input: { query: "agent harness" },
    state: "input-available" as const,
    toolCallId: "web-1",
    type: "tool-webSearch" as const,
  };
  assert.equal(getToolPartAggregateStatus(part), "pending");
  assert.equal(
    getToolPartAggregateStatus(part, { isMessageStreaming: false }),
    "completed"
  );
});
