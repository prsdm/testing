import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeEmptyAssistantMessages,
  mergeHydratedChatMessages,
} from "./workflow-message-bridge";

test("prefers local terminal workflow status over stale server running", () => {
  const merged = mergeHydratedChatMessages(
    [
      {
        id: "assistant-1",
        metadata: { workflowRunStatus: "success" },
        parts: [{ text: "Done.", type: "text" }],
        role: "assistant",
      },
    ],
    [
      {
        id: "assistant-1",
        metadata: { workflowRunStatus: "running" },
        parts: [{ text: "Done.", type: "text" }],
        role: "assistant",
      },
    ]
  );

  assert.equal(merged[0]?.metadata?.workflowRunStatus, "success");
});

test("keeps server assistant parts after workflow finalization", () => {
  const local = [
    {
      id: "assistant-1",
      metadata: { workflowRunStatus: "success" as const },
      parts: [
        {
          state: "done" as const,
          text: "Checking files",
          type: "reasoning" as const,
        },
        {
          input: { knowledgeBaseScope: true, query: "earnings" },
          output: {
            citationMap: { 1: 1 },
            documents: [{ content: "Revenue", document: 1, title: "Earnings" }],
            steps: [{ type: "done" }],
          },
          state: "output-available" as const,
          toolCallId: "search-1",
          type: "tool-sourceSearch" as const,
        },
        { text: "Revenue grew 20%.", type: "text" as const },
      ],
      role: "assistant" as const,
    },
  ];
  const server = [
    {
      id: "assistant-1",
      metadata: { workflowRunStatus: "success" as const },
      parts: [
        {
          input: { knowledgeBaseScope: true, query: "earnings" },
          output: {
            citationMap: { 1: 1 },
            documents: [{ content: "Revenue", document: 1, title: "Earnings" }],
            steps: [{ type: "done" }],
          },
          state: "output-available" as const,
          toolCallId: "search-1",
          type: "tool-sourceSearch" as const,
        },
        { text: "Revenue grew 20%.", type: "text" as const },
      ],
      role: "assistant" as const,
    },
  ];

  const merged = mergeHydratedChatMessages(local, server);
  assert.equal(
    merged[0]?.parts.some((part) => part.type === "reasoning"),
    false
  );
  const searchPart = merged[0]?.parts.find(
    (part) => part.type === "tool-sourceSearch"
  );
  assert.equal(
    searchPart && "state" in searchPart ? searchPart.state : undefined,
    "output-available"
  );
});

test("server revalidation cannot move the user below its assistant", () => {
  const user = {
    id: "user-1",
    parts: [{ text: "Create sample.txt", type: "text" as const }],
    role: "user" as const,
  };
  const assistant = {
    id: "assistant-1",
    parts: [{ text: "The action was rejected.", type: "text" as const }],
    role: "assistant" as const,
  };

  const merged = mergeHydratedChatMessages(
    [user, assistant],
    [assistant, user]
  );

  assert.deepEqual(
    merged.map((message) => message.id),
    ["user-1", "assistant-1"]
  );
});

test("server finalization replaces streamed assistant parts", () => {
  const merged = mergeHydratedChatMessages(
    [
      {
        id: "assistant-1",
        parts: [
          {
            state: "done",
            text: 'Create mvp.doc with "MVP" content.',
            type: "reasoning",
          },
          { text: "I'll create the file.", type: "text" },
          {
            input: { name: "mvp.doc" },
            state: "approval-requested",
            toolCallId: "call-1",
            type: "tool-driveUploadFile",
          },
        ],
        role: "assistant",
      },
    ],
    [
      {
        id: "assistant-1",
        parts: [
          {
            state: "done",
            text: 'Create m vp .doc with " M VP " content .',
            type: "reasoning",
          },
          { text: "I'll create the file.", type: "text" },
          {
            input: { name: "mvp.doc" },
            state: "approval-requested",
            toolCallId: "call-1",
            type: "tool-driveUploadFile",
          },
        ],
        role: "assistant",
      },
    ]
  );

  const thought = merged[0]?.parts.find((part) => part.type === "reasoning");
  assert.equal(
    thought?.type === "reasoning" ? thought.text : undefined,
    'Create m vp .doc with " M VP " content .'
  );
});

test("removes tool calls copied into a later assistant turn", () => {
  const searchPart = {
    input: { query: "earnings" },
    output: { citationMap: {}, documents: [], steps: [] },
    state: "output-available" as const,
    toolCallId: "search-1",
    type: "tool-sourceSearch" as const,
  };
  const messages = dedupeEmptyAssistantMessages([
    {
      id: "assistant-1",
      parts: [searchPart, { text: "Here is the report.", type: "text" }],
      role: "assistant",
    },
    {
      id: "user-2",
      parts: [{ text: "Thanks", type: "text" }],
      role: "user",
    },
    {
      id: "assistant-2",
      parts: [{ text: "You're welcome!", type: "text" }, searchPart],
      role: "assistant",
    },
  ]);

  assert.deepEqual(
    messages[2]?.parts.map((part) => part.type),
    ["text"]
  );
});
