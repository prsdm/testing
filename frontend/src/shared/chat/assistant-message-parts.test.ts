import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "../types";
import {
  getAssistantPartKey,
  getLatestChatTodoPlan,
  getLatestTodoPart,
  isReasoningPartRevealing,
  selectAssistantPartOrder,
  shouldDeferAssistantPartReveal,
} from "./assistant-message-parts";
import { todoProgressLabel } from "./todo-types";

function selectedTypes(parts: ChatMessage["parts"]) {
  return selectAssistantPartOrder(parts).map((index) => parts[index]?.type);
}

test("selects renderable parts in chronological order", () => {
  const parts: ChatMessage["parts"] = [
    { state: "streaming", text: "", type: "reasoning" },
    { text: "Checking attachments first…", type: "text" },
    {
      input: { query: "earnings" },
      state: "input-available",
      toolCallId: "search-1",
      type: "tool-sourceSearch",
    },
    { state: "done", text: "Reviewing results.", type: "reasoning" },
    { text: "Here is the summary.", type: "text" },
  ];

  assert.deepEqual(selectedTypes(parts), [
    "reasoning",
    "text",
    "tool-sourceSearch",
    "reasoning",
    "text",
  ]);
});

test("hides an approved tool placeholder until execution emits a result", () => {
  const parts: ChatMessage["parts"] = [
    {
      approval: { approved: true, id: "approval-1" },
      input: { name: "sample.txt" },
      state: "approval-responded",
      toolCallId: "approval-call",
      type: "tool-driveUploadFile",
    },
    {
      input: { name: "sample.txt" },
      output: { id: "file-1", name: "sample.txt" },
      state: "output-available",
      toolCallId: "execution-call",
      type: "tool-driveUploadFile",
    },
  ];

  assert.deepEqual(selectedTypes(parts), [
    "tool-driveUploadFile",
    "tool-driveUploadFile",
  ]);
});

test("renders consecutive reasoning snapshots as one Thought", () => {
  const parts: ChatMessage["parts"] = [
    { state: "streaming", text: "Planning", type: "reasoning" },
    { state: "streaming", text: "Planning the search", type: "reasoning" },
    {
      state: "streaming",
      text: "Planning the knowledge base search",
      type: "reasoning",
    },
  ];

  assert.deepEqual(selectAssistantPartOrder(parts), [2]);
});

test("keeps inter-tool commentary and hides approval placeholder text", () => {
  const parts: ChatMessage["parts"] = [
    { text: "I'll search first.", type: "text" },
    {
      input: { queries: ["earnings"] },
      state: "input-streaming",
      toolCallId: "web-1",
      type: "tool-webSearch",
    },
    { text: "I found one report; checking another.", type: "text" },
    {
      input: { urls: ["https://example.com"] },
      state: "input-available",
      toolCallId: "url-1",
      type: "tool-openUrl",
    },
    { text: "Waiting for approval to run `driveUploadFile`.", type: "text" },
  ];

  assert.deepEqual(selectedTypes(parts), [
    "text",
    "tool-webSearch",
    "text",
    "tool-openUrl",
  ]);
});

test("excludes task plans from inline message order", () => {
  const parts: ChatMessage["parts"] = [
    { state: "done", text: "Planning.", type: "reasoning" },
    {
      input: {
        todos: [
          {
            activeForm: "Inspecting files",
            content: "Inspect files",
            status: "pending",
          },
        ],
      },
      output: {
        todos: [
          {
            activeForm: "Inspecting files",
            content: "Inspect files",
            status: "pending",
          },
        ],
      },
      state: "output-available",
      toolCallId: "todo-1",
      type: "tool-todoWrite",
    },
    {
      input: { query: "roadmap" },
      state: "input-available",
      toolCallId: "search-1",
      type: "tool-sourceSearch",
    },
    {
      input: {
        todos: [
          {
            activeForm: "Inspecting files",
            content: "Inspect files",
            status: "completed",
          },
          {
            activeForm: "Summarizing",
            content: "Summarize",
            status: "completed",
          },
        ],
      },
      output: {
        todos: [
          {
            activeForm: "Inspecting files",
            content: "Inspect files",
            status: "completed",
          },
          {
            activeForm: "Summarizing",
            content: "Summarize",
            status: "completed",
          },
        ],
      },
      state: "output-available",
      toolCallId: "todo-2",
      type: "tool-todoWrite",
    },
    { text: "Done.", type: "text" },
  ];

  assert.deepEqual(selectedTypes(parts), [
    "reasoning",
    "tool-sourceSearch",
    "text",
  ]);
  assert.equal(getLatestTodoPart(parts)?.todos.length, 2);
});

test("selects the latest chat task plan until a newer user turn starts", () => {
  const taskMessage: ChatMessage = {
    id: "assistant-1",
    parts: [
      {
        input: {
          todos: [
            {
              activeForm: "Inspecting files",
              content: "Inspect files",
              status: "in_progress",
            },
          ],
        },
        output: {
          todos: [
            {
              activeForm: "Inspecting files",
              content: "Inspect files",
              status: "in_progress",
            },
          ],
        },
        state: "output-available",
        toolCallId: "todo-1",
        type: "tool-todoWrite",
      },
    ],
    role: "assistant",
  };

  assert.equal(getLatestChatTodoPlan([taskMessage])?.toolCallId, "todo-1");
  assert.equal(
    getLatestChatTodoPlan([
      taskMessage,
      {
        id: "user-2",
        parts: [{ text: "Start another task", type: "text" }],
        role: "user",
      },
    ]),
    null
  );
});

test("hides a stale incomplete task plan after its workflow finishes", () => {
  const messages: ChatMessage[] = [
    {
      id: "assistant-1",
      metadata: { workflowRunStatus: "success" },
      parts: [
        {
          input: {
            todos: [
              {
                activeForm: "Saving document",
                content: "Save document",
                status: "pending",
              },
            ],
          },
          output: {
            todos: [
              {
                activeForm: "Saving document",
                content: "Save document",
                status: "pending",
              },
            ],
          },
          state: "output-available",
          toolCallId: "todo-1",
          type: "tool-todoWrite",
        },
      ],
      role: "assistant",
    },
  ];

  assert.equal(getLatestChatTodoPlan(messages), null);
});

test("keeps a partially completed task plan visible after the workflow finishes", () => {
  const messages: ChatMessage[] = [
    {
      id: "assistant-1",
      metadata: { workflowRunStatus: "success" },
      parts: [
        {
          input: {
            todos: [
              {
                activeForm: "Creating Finance folder",
                content: "Create Finance folder",
                status: "completed",
              },
              {
                activeForm: "Creating Legal folder",
                content: "Create Legal folder",
                status: "pending",
              },
            ],
          },
          output: {
            todos: [
              {
                activeForm: "Creating Finance folder",
                content: "Create Finance folder",
                status: "completed",
              },
              {
                activeForm: "Creating Legal folder",
                content: "Create Legal folder",
                status: "pending",
              },
            ],
          },
          state: "output-available",
          toolCallId: "todo-1",
          type: "tool-todoWrite",
        },
      ],
      role: "assistant",
    },
  ];

  const plan = getLatestChatTodoPlan(messages);
  assert.equal(plan?.todos.length, 2);
  assert.equal(plan ? todoProgressLabel(plan.todos) : null, "1/2 completed");
});

test("keeps a fully skipped task plan visible after the workflow finishes", () => {
  const messages: ChatMessage[] = [
    {
      id: "assistant-1",
      metadata: { workflowRunStatus: "success" },
      parts: [
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
      ],
      role: "assistant",
    },
  ];

  const plan = getLatestChatTodoPlan(messages);
  assert.equal(
    plan ? todoProgressLabel(plan.todos) : null,
    "0/1 completed · 1 skipped"
  );
});

test("does not revive an older task plan from reordered hydrated messages", () => {
  const messages: ChatMessage[] = [
    {
      id: "user-2",
      metadata: { createdAt: "2026-08-13T15:00:01.000Z" },
      parts: [{ text: "Thanks", type: "text" }],
      role: "user",
    },
    {
      id: "assistant-1",
      metadata: { createdAt: "2026-08-13T15:00:00.000Z" },
      parts: [
        {
          input: {
            todos: [
              {
                activeForm: "Saving document",
                content: "Save document",
                status: "in_progress",
              },
            ],
          },
          output: {
            todos: [
              {
                activeForm: "Saving document",
                content: "Save document",
                status: "in_progress",
              },
            ],
          },
          state: "output-available",
          toolCallId: "todo-1",
          type: "tool-todoWrite",
        },
      ],
      role: "assistant",
    },
  ];

  assert.equal(getLatestChatTodoPlan(messages), null);
});

test("commentary keys remain stable when reasoning is inserted", () => {
  const search = {
    input: { query: "earnings" },
    output: {
      citationMap: {},
      documents: [],
      steps: [{ type: "done" as const }],
    },
    state: "output-available" as const,
    toolCallId: "search-1",
    type: "tool-sourceSearch" as const,
  };
  const before: ChatMessage["parts"] = [
    search,
    { text: "I found the report.", type: "text" },
  ];
  const after: ChatMessage["parts"] = [
    search,
    { state: "done", text: "Reviewing.", type: "reasoning" },
    { text: "I found the report.", type: "text" },
  ];

  assert.equal(getAssistantPartKey(before, 1), getAssistantPartKey(after, 2));
});

test("defers a tool while preceding reasoning streams", () => {
  const parts: ChatMessage["parts"] = [
    { state: "streaming", text: "Planning", type: "reasoning" },
    { text: "I'll search.", type: "text" },
    {
      input: { query: "roadmap" },
      state: "input-streaming",
      toolCallId: "search-1",
      type: "tool-sourceSearch",
    },
  ];

  const reasoning = parts[0];
  assert.ok(reasoning);
  assert.equal(isReasoningPartRevealing(reasoning, true), true);
  assert.equal(
    shouldDeferAssistantPartReveal({
      isMessageStreaming: true,
      messageParts: parts,
      partIndex: 2,
      revealingNarratives: {},
    }),
    true
  );
});

test("does not hide an older tool after a newer step has started", () => {
  const parts: ChatMessage["parts"] = [
    { state: "streaming", text: "Planning", type: "reasoning" },
    {
      input: { query: "roadmap" },
      output: { citationMap: {}, documents: [], steps: [] },
      state: "output-available",
      toolCallId: "search-1",
      type: "tool-sourceSearch",
    },
    { state: "streaming", text: "Reviewing results", type: "reasoning" },
  ];

  assert.equal(
    shouldDeferAssistantPartReveal({
      isMessageStreaming: true,
      messageParts: parts,
      partIndex: 1,
      revealingNarratives: {},
    }),
    false
  );
});

test("defers a tool while preceding commentary typewrites", () => {
  const parts: ChatMessage["parts"] = [
    { state: "done", text: "Planned.", type: "reasoning" },
    { text: "I'll search.", type: "text" },
    {
      input: { query: "roadmap" },
      state: "input-streaming",
      toolCallId: "search-1",
      type: "tool-sourceSearch",
    },
  ];
  const key = getAssistantPartKey(parts, 1);

  assert.equal(
    shouldDeferAssistantPartReveal({
      isMessageStreaming: true,
      messageParts: parts,
      partIndex: 2,
      revealingNarratives: { [key]: true },
    }),
    true
  );
  assert.equal(
    shouldDeferAssistantPartReveal({
      isMessageStreaming: true,
      messageParts: parts,
      partIndex: 2,
      revealingNarratives: {},
    }),
    false
  );
});

test("tool boundaries stop reveal deferral", () => {
  const parts: ChatMessage["parts"] = [
    { state: "streaming", text: "Still marked streaming.", type: "reasoning" },
    {
      input: { queries: ["roadmap"] },
      output: { sources: [] },
      state: "output-available",
      toolCallId: "web-1",
      type: "tool-webSearch",
    },
    {
      input: { urls: ["https://example.com"] },
      state: "input-streaming",
      toolCallId: "url-1",
      type: "tool-openUrl",
    },
  ];

  assert.equal(
    shouldDeferAssistantPartReveal({
      isMessageStreaming: true,
      messageParts: parts,
      partIndex: 2,
      revealingNarratives: {},
    }),
    false
  );
});

test("connector and document approvals bypass reveal deferral", () => {
  const prefix: ChatMessage["parts"] = [
    { state: "streaming", text: "Planning", type: "reasoning" },
    { text: "I need approval.", type: "text" },
  ];
  const approvals: ChatMessage["parts"] = [
    {
      approval: { id: "approval-drive-1" },
      input: { content: "report", mimeType: "text/plain", name: "report.txt" },
      state: "approval-requested",
      toolCallId: "drive-1",
      type: "tool-driveUploadFile",
    },
    {
      approval: { id: "approval-document-1" },
      input: { kind: "text", title: "Report" },
      state: "approval-requested",
      toolCallId: "document-1",
      type: "tool-createDocument",
    },
  ];

  for (const approval of approvals) {
    const parts = [...prefix, approval] as ChatMessage["parts"];
    assert.equal(
      shouldDeferAssistantPartReveal({
        isMessageStreaming: true,
        messageParts: parts,
        partIndex: 2,
        revealingNarratives: {
          [getAssistantPartKey(parts, 1)]: true,
        },
      }),
      false
    );
  }
});

test("completed messages never defer tool rendering", () => {
  const parts: ChatMessage["parts"] = [
    { state: "streaming", text: "Planning", type: "reasoning" },
    {
      input: { chartType: "bar", data: [], title: "Revenue" },
      state: "input-streaming",
      toolCallId: "chart-1",
      type: "tool-createChart",
    },
  ];
  assert.equal(
    shouldDeferAssistantPartReveal({
      isMessageStreaming: false,
      messageParts: parts,
      partIndex: 1,
      revealingNarratives: {},
    }),
    false
  );
});
