import assert from "node:assert/strict";
import test from "node:test";
import { assistantTurnNeedsContinuation } from "@/shared/chat/assistant-turn-continuation";

test("assistantTurnNeedsContinuation is true after search without a final answer", () => {
  assert.equal(
    assistantTurnNeedsContinuation([
      {
        state: "done",
        text: "I'll locate the earnings flash report and create the Finance folder.",
        type: "reasoning",
      },
      {
        input: { query: "earnings flash report" },
        output: { documents: [{ title: "Q4 Flash" }] },
        state: "output-available",
        toolCallId: "search-1",
        type: "tool-sourceSearch",
      },
    ]),
    true
  );
});

test("assistantTurnNeedsContinuation is false while a tool call has no result yet", () => {
  assert.equal(
    assistantTurnNeedsContinuation([
      {
        input: { query: "earnings flash report" },
        output: { documents: [] },
        state: "output-available",
        toolCallId: "search-1",
        type: "tool-sourceSearch",
      },
      {
        input: { query: "Finance" },
        state: "input-available",
        toolCallId: "drive-search-1",
        type: "tool-driveSearchFiles",
      },
    ]),
    false
  );
});

test("assistantTurnNeedsContinuation is false once a final answer follows tools", () => {
  assert.equal(
    assistantTurnNeedsContinuation([
      {
        input: { query: "earnings" },
        output: { documents: [] },
        state: "output-available",
        toolCallId: "search-1",
        type: "tool-sourceSearch",
      },
      {
        text: "I found the earnings flash report and saved the summary to Drive.",
        type: "text",
      },
    ]),
    false
  );
});

test("assistantTurnNeedsContinuation is false while approval is pending", () => {
  assert.equal(
    assistantTurnNeedsContinuation([
      {
        approval: { id: "approval-1" },
        input: { name: "Finance" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveCreateFolder",
      },
    ]),
    false
  );
});

test("assistantTurnNeedsContinuation continues when todo plan was never executed", () => {
  const parts = [
    {
      input: {
        todos: [
          {
            activeForm: "Creating Finance folder",
            content: "Create Finance folder",
            status: "pending" as const,
          },
        ],
      },
      output: {
        todos: [
          {
            activeForm: "Creating Finance folder",
            content: "Create Finance folder",
            status: "pending" as const,
          },
        ],
      },
      state: "output-available" as const,
      toolCallId: "todo-1",
      type: "tool-todoWrite" as const,
    },
    {
      text: "The Drive folder-creation tool isn't available in this session.",
      type: "text" as const,
    },
  ];

  assert.equal(assistantTurnNeedsContinuation(parts), true);
  assert.equal(
    assistantTurnNeedsContinuation(parts, {
      todoExecutionNudged: true,
    }),
    false
  );
});

test("assistantTurnNeedsContinuation continues after a read before a planned write", () => {
  assert.equal(
    assistantTurnNeedsContinuation([
      {
        input: {
          todos: [
            {
              activeForm: "Searching Slack",
              content: "Search Slack",
              status: "completed",
            },
            {
              activeForm: "Creating Finance folder",
              content: "Create Finance folder",
              status: "pending",
            },
          ],
        },
        output: {
          todos: [
            {
              activeForm: "Searching Slack",
              content: "Search Slack",
              status: "completed",
            },
            {
              activeForm: "Creating Finance folder",
              content: "Create Finance folder",
              status: "pending",
            },
          ],
        },
        state: "output-available",
        toolCallId: "todo-1",
        type: "tool-todoWrite",
      },
      {
        input: { query: "Finance owner" },
        output: { messages: [] },
        state: "output-available",
        toolCallId: "search-1",
        type: "tool-slackSearchMessages",
      },
      {
        text: "I found no matching Slack messages.",
        type: "text",
      },
    ]),
    true
  );
});

test("assistantTurnNeedsContinuation stops when every todo is settled", () => {
  assert.equal(
    assistantTurnNeedsContinuation([
      {
        input: {
          todos: [
            {
              activeForm: "Creating Finance folder",
              content: "Create Finance folder",
              status: "skipped",
            },
          ],
        },
        output: {
          todos: [
            {
              activeForm: "Creating Finance folder",
              content: "Create Finance folder",
              status: "skipped",
            },
          ],
        },
        state: "output-available",
        toolCallId: "todo-1",
        type: "tool-todoWrite",
      },
      {
        text: "Finance was skipped after you rejected the approval.",
        type: "text",
      },
    ]),
    false
  );
});

test("assistantTurnNeedsContinuation continues when open todos remain after a final answer", () => {
  const parts = [
    {
      input: {
        todos: [
          {
            activeForm: "Creating Finance folder",
            content: "Create Finance folder",
            status: "completed" as const,
          },
          {
            activeForm: "Creating Legal folder",
            content: "Create Legal folder",
            status: "pending" as const,
          },
        ],
      },
      output: {
        todos: [
          {
            activeForm: "Creating Finance folder",
            content: "Create Finance folder",
            status: "completed" as const,
          },
          {
            activeForm: "Creating Legal folder",
            content: "Create Legal folder",
            status: "pending" as const,
          },
        ],
      },
      state: "output-available" as const,
      toolCallId: "todo-1",
      type: "tool-todoWrite" as const,
    },
    {
      input: { name: "Finance" },
      output: { id: "folder-1", name: "Finance" },
      state: "output-available" as const,
      toolCallId: "drive-1",
      type: "tool-driveCreateFolder" as const,
    },
    {
      text: "Created the Finance folder. Let me know if you want Legal too.",
      type: "text" as const,
    },
  ];

  assert.equal(assistantTurnNeedsContinuation(parts), true);
  assert.equal(
    assistantTurnNeedsContinuation(parts, { todoPendingStepsNudged: true }),
    false
  );
});
