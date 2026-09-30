import assert from "node:assert/strict";
import test from "node:test";
import type { UIMessage } from "ai";
import {
  chatMessageToWorkflowMessage,
  dedupeEmptyAssistantMessages,
  workflowMessagesToChatMessages,
  workflowMessageToChatMessage,
} from "./workflow-message-bridge";

test("drops trailing empty assistant placeholders from failed or cancelled turns", () => {
  const messages = workflowMessagesToChatMessages([
    {
      id: "user-1",
      parts: [{ text: "Hello", type: "text" }],
      role: "user",
    },
    {
      id: "assistant-empty",
      metadata: { workflowRunStatus: "failed" },
      parts: [{ text: "", type: "text" }],
      role: "assistant",
    },
  ]);

  assert.deepEqual(
    messages.map((message) => message.id),
    ["user-1"]
  );
});

test("drops empty assistant placeholders before a populated response", () => {
  const messages = dedupeEmptyAssistantMessages([
    {
      id: "user-1",
      parts: [{ text: "Hello", type: "text" }],
      role: "user",
    },
    {
      id: "assistant-empty",
      parts: [{ text: "", type: "text" }],
      role: "assistant",
    },
    {
      id: "assistant-full",
      parts: [{ text: "Hi there", type: "text" }],
      role: "assistant",
    },
  ]);

  assert.deepEqual(
    messages.map((message) => message.id),
    ["user-1", "assistant-full"]
  );
});

test("drops replayed assistant stream after a completed answer", () => {
  const completeText =
    "I'll search the knowledge base files for the earnings flash report, then extract and summarize its main financial and operating metrics. Revenue grew 20%.";
  const messages = dedupeEmptyAssistantMessages([
    {
      id: "user-1",
      parts: [{ text: "Summarize earnings", type: "text" }],
      role: "user",
    },
    {
      id: "assistant-complete",
      metadata: {
        workflowRunId: "run-1",
        workflowRunStatus: "success",
      },
      parts: [{ text: completeText, type: "text" }],
      role: "assistant",
    },
    {
      id: "assistant-replay",
      metadata: { workflowRunId: "run-1", workflowRunStatus: "running" },
      parts: [
        {
          text: "I'll search the knowledge base files for the earnings flash report, then",
          type: "text",
        },
      ],
      role: "assistant",
    },
  ]);

  assert.deepEqual(
    messages.map((message) => message.id),
    ["user-1", "assistant-complete"]
  );
});

test("drops duplicate assistant responses from stream id mismatches", () => {
  const duplicateText =
    "I'm unable to search or read files in the knowledge base with the available Drive access.";
  const messages = dedupeEmptyAssistantMessages([
    {
      id: "user-1",
      parts: [{ text: "Find the earnings report", type: "text" }],
      role: "user",
    },
    {
      id: "assistant-client",
      parts: [
        {
          state: "done",
          text: "Need knowledge base access",
          type: "reasoning",
        },
        { text: duplicateText, type: "text" },
      ],
      role: "assistant",
    },
    {
      id: "assistant-server",
      metadata: {
        createdAt: "2026-08-13T09:08:00.000Z",
        workflowRunId: "run-1",
      },
      parts: [
        {
          state: "done",
          text: "Need knowledge base access",
          type: "reasoning",
        },
        { text: duplicateText, type: "text" },
      ],
      role: "assistant",
    },
  ]);

  assert.deepEqual(
    messages.map((message) => message.id),
    ["user-1", "assistant-server"]
  );
});

test("preserves chronological reasoning, text, tools, and approvals", () => {
  const message: UIMessage = {
    id: "assistant-1",
    parts: [
      { state: "done", text: "Check the source", type: "reasoning" },
      { text: "I’ll verify that.", type: "text" },
      {
        approval: { id: "approval-call-1" },
        input: { title: "Plan" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-createDocument",
      },
    ],
    role: "assistant",
  };

  const local = workflowMessageToChatMessage(message);
  assert.deepEqual(
    local.parts.map((part) => part.type),
    ["reasoning", "text", "tool-createDocument"]
  );
  assert.equal(
    local.metadata?.pendingToolApproval?.approvalId,
    "approval-call-1"
  );
  assert.equal(local.metadata?.workflowRunStatus, "suspended");

  const roundTrip = chatMessageToWorkflowMessage(local);
  assert.deepEqual(roundTrip.parts, message.parts);
});

test("preserves a completed workflow status when no approval is pending", () => {
  const local = workflowMessageToChatMessage({
    id: "assistant-2",
    metadata: {
      workflowRunId: "run-1",
      workflowRunStatus: "success",
    },
    parts: [{ text: "Done.", type: "text" }],
    role: "assistant",
  });

  assert.equal(local.metadata?.workflowRunStatus, "success");
  assert.equal(local.metadata?.pendingToolApproval, undefined);
});
