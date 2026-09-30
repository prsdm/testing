import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeAssistantMessageParts,
  mergeAssistantMessagePartsWithSuffix,
  mergeWorkflowChatMessages,
} from "@/shared/chat/merge-workflow-chat-messages";

test("mergeAssistantMessageParts keeps approval-responded over stale approval-requested", () => {
  const merged = mergeAssistantMessageParts(
    [
      {
        approval: { approved: true, id: "approval-search-1" },
        input: { query: "earnings" },
        state: "approval-responded",
        toolCallId: "search-1",
        type: "tool-sourceSearch",
      },
    ],
    [
      {
        approval: { id: "approval-search-1" },
        input: { query: "earnings" },
        state: "approval-requested",
        toolCallId: "search-1",
        type: "tool-sourceSearch",
      },
    ]
  );

  assert.equal(
    merged[0] && "state" in merged[0] ? merged[0].state : undefined,
    "approval-responded"
  );
});

test("mergeAssistantMessageParts keeps executed output over approval-responded", () => {
  const merged = mergeAssistantMessageParts(
    [
      {
        approval: { approved: true, id: "approval-1" },
        input: { name: "Finance" },
        state: "approval-responded",
        toolCallId: "folder-1",
        type: "tool-driveCreateFolder",
      },
    ],
    [
      {
        input: { name: "Finance" },
        output: { id: "folder-123", name: "Finance" },
        state: "output-available",
        toolCallId: "folder-1",
        type: "tool-driveCreateFolder",
      },
    ]
  );

  assert.equal(
    merged[0] && "state" in merged[0] ? merged[0].state : undefined,
    "output-available"
  );
});

test("mergeAssistantMessageParts keeps local denial over incoming approval", () => {
  const merged = mergeAssistantMessageParts(
    [
      {
        errorText: "Rejected by user",
        input: { name: "sample.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ],
    [
      {
        approval: { id: "approval-call-1" },
        input: { name: "sample.txt" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ]
  );

  assert.equal(
    merged[0] && "state" in merged[0] ? merged[0].state : undefined,
    "output-denied"
  );
});

test("mergeAssistantMessagePartsWithSuffix keeps local rejection narrative", () => {
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      {
        input: { name: "sample.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
      {
        text: "The file was not created because you rejected the action.",
        type: "text",
      },
    ],
    [
      {
        input: { name: "sample.txt" },
        output: { id: "file-1", name: "sample.txt" },
        state: "output-available",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ]
  );

  assert.equal(
    merged[0] && "state" in merged[0] ? merged[0].state : undefined,
    "output-denied"
  );
  assert.equal(merged[1]?.type, "text");
  assert.match(merged[1]?.text ?? "", /not created because you rejected/i);
});

test("mergeAssistantMessagePartsWithSuffix does not accumulate streaming text", () => {
  const fullText =
    "I'll create sample.txt in your Google Drive root with a short sample line of text.";
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      { state: "done", text: "Thinking", type: "reasoning" },
      { text: "I'll create sample.txt in your Google Drive", type: "text" },
      {
        input: { name: "sample.txt" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ],
    [
      { state: "done", text: "Thinking", type: "reasoning" },
      { text: fullText, type: "text" },
      {
        input: { name: "sample.txt" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ]
  );

  assert.equal(merged.filter((part) => part.type === "text").length, 1);
  assert.equal(
    merged[1]?.type === "text" ? merged[1].text : undefined,
    fullText
  );
});

test("mergeAssistantMessagePartsWithSuffix coalesces post-denial stream snapshots", () => {
  const deniedTool = {
    input: { name: "sample.txt" },
    output: { reason: "Rejected by user", type: "execution-denied" },
    state: "output-denied" as const,
    toolCallId: "call-1",
    type: "tool-driveUploadFile" as const,
  };
  const fullText =
    "It seems like there was an issue creating the file. Please let me know if you want me to try again.";
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      { text: "I'm creating sample.txt in Drive.", type: "text" },
      deniedTool,
      { text: "It", type: "text" },
      { text: "It seems", type: "text" },
      { text: "It seems like there was", type: "text" },
    ],
    [
      { text: "I'm creating sample.txt in Drive.", type: "text" },
      deniedTool,
      { text: fullText, type: "text" },
    ]
  );

  const suffixTexts = merged
    .slice(2)
    .filter((part) => part.type === "text")
    .map((part) => part.text);
  assert.equal(suffixTexts.length, 1);
  assert.equal(suffixTexts[0], fullText);
});

test("post-denial merge preserves rejection explanation and final response", () => {
  const deniedTool = {
    input: { name: "summary.txt" },
    output: { reason: "Rejected by user", type: "execution-denied" },
    state: "output-denied" as const,
    toolCallId: "call-1",
    type: "tool-driveUploadFile" as const,
  };
  const rejectionExplanation =
    "I couldn't save the summary because the Drive action was rejected.";
  const finalResponse =
    "I found the earnings report and summarized the supported metrics above.";
  const merged = mergeAssistantMessagePartsWithSuffix(
    [deniedTool, { text: rejectionExplanation, type: "text" }],
    [deniedTool, { text: finalResponse, type: "text" }]
  );

  assert.deepEqual(
    merged.filter((part) => part.type === "text").map((part) => part.text),
    [rejectionExplanation, finalResponse]
  );
});

test("completed tool keeps its local final answer during stale sync", () => {
  const completedTool = {
    input: { name: "sample.txt" },
    output: { id: "file-1", name: "sample.txt" },
    state: "output-available" as const,
    toolCallId: "call-1",
    type: "tool-driveUploadFile" as const,
  };
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      { text: "I'll create sample.txt.", type: "text" },
      completedTool,
      { text: "Created sample.txt in your Google Drive.", type: "text" },
    ],
    [{ text: "I'll create sample.txt.", type: "text" }, completedTool]
  );

  assert.deepEqual(
    merged.map((part) => part.type),
    ["text", "tool-driveUploadFile", "text"]
  );
  assert.equal(
    merged[2]?.type === "text" ? merged[2].text : undefined,
    "Created sample.txt in your Google Drive."
  );
});

test("completed search does not move or duplicate streaming commentary", () => {
  const completedSearch = {
    input: { query: "earnings flash report" },
    output: { documents: [] },
    state: "output-available" as const,
    toolCallId: "search-1",
    type: "tool-sourceSearch" as const,
  };
  const commentary =
    "The indexed extract is truncated after the headline metrics.";
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      completedSearch,
      {
        state: "done",
        text: "Checking the available extract.",
        type: "reasoning",
      },
      { text: commentary, type: "text" },
    ],
    [
      completedSearch,
      {
        state: "done",
        text: "Checking the available extract.",
        type: "reasoning",
      },
      { text: commentary, type: "text" },
      { text: commentary, type: "text" },
    ]
  );

  assert.deepEqual(
    merged.map((part) => part.type),
    ["tool-sourceSearch", "reasoning", "text"]
  );
});

test("stale search snapshot does not hide streamed commentary", () => {
  const completedSearch = {
    input: { query: "earnings flash report" },
    output: { documents: [] },
    state: "output-available" as const,
    toolCallId: "search-1",
    type: "tool-sourceSearch" as const,
  };
  const commentary =
    "The report confirms strong year-over-year growth and beats versus consensus.";
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      completedSearch,
      { state: "done", text: "Summarizing the metrics.", type: "reasoning" },
      { text: commentary, type: "text" },
    ],
    [
      completedSearch,
      { state: "done", text: "Summarizing the metrics.", type: "reasoning" },
    ]
  );

  assert.deepEqual(
    merged.map((part) => part.type),
    ["tool-sourceSearch", "reasoning", "text"]
  );
  assert.equal(
    merged[2]?.type === "text" ? merged[2].text : undefined,
    commentary
  );
});

test("mergeWorkflowChatMessages clears pending approval after local reject", () => {
  const merged = mergeWorkflowChatMessages(
    [
      {
        id: "assistant-1",
        metadata: {
          workflowRunStatus: "success",
        },
        parts: [
          {
            input: { name: "sample.txt" },
            output: { reason: "Rejected by user", type: "execution-denied" },
            state: "output-denied",
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
        metadata: {
          pendingToolApproval: {
            approvalId: "approval-call-1",
            toolCallId: "call-1",
            toolName: "driveUploadFile",
          },
          workflowRunStatus: "suspended",
        },
        parts: [
          {
            approval: { id: "approval-call-1" },
            input: { name: "sample.txt" },
            state: "approval-requested",
            toolCallId: "call-1",
            type: "tool-driveUploadFile",
          },
        ],
        role: "assistant",
      },
    ]
  );

  assert.equal(merged[0]?.metadata?.pendingToolApproval, undefined);
  const toolPart = merged[0]?.parts[0];
  assert.equal(
    toolPart && "state" in toolPart ? toolPart.state : undefined,
    "output-denied"
  );
});

test("stale empty output cannot replace a persisted approval request", () => {
  const merged = mergeWorkflowChatMessages(
    [
      {
        id: "assistant-1",
        metadata: {
          pendingToolApproval: {
            approvalId: "approval-call-1",
            toolCallId: "call-1",
            toolName: "driveUploadFile",
          },
          workflowRunStatus: "suspended",
        },
        parts: [
          {
            approval: { id: "approval-call-1" },
            input: { name: "sample.txt" },
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
        metadata: {
          workflowRunStatus: "success",
        },
        parts: [
          {
            input: { name: "sample.txt" },
            state: "output-available",
            toolCallId: "call-1",
            type: "tool-driveUploadFile",
          },
        ],
        role: "assistant",
      },
    ]
  );

  const toolPart = merged[0]?.parts[0];
  assert.equal(
    toolPart && "state" in toolPart ? toolPart.state : undefined,
    "approval-requested"
  );
  assert.equal(
    merged[0]?.metadata?.pendingToolApproval?.approvalId,
    "approval-call-1"
  );
  assert.equal(merged[0]?.metadata?.workflowRunStatus, "suspended");
});

test("workflow sync preserves the established user-assistant chronology", () => {
  const user = {
    id: "user-1",
    parts: [{ text: "Create sample.txt", type: "text" as const }],
    role: "user" as const,
  };
  const assistant = {
    id: "assistant-1",
    parts: [{ text: "I'll create it.", type: "text" as const }],
    role: "assistant" as const,
  };

  const merged = mergeWorkflowChatMessages([user], [assistant, user]);

  assert.deepEqual(
    merged.map((message) => message.id),
    ["user-1", "assistant-1"]
  );
});

test("rejection continuation preserves earlier reasoning", () => {
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      { state: "done", text: "Preparing the Drive upload.", type: "reasoning" },
      { text: "I'll create sample.txt.", type: "text" },
      {
        input: { name: "sample.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ],
    [
      { text: "I'll create sample.txt.", type: "text" },
      {
        input: { name: "sample.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
      { text: "The file was not created.", type: "text" },
    ]
  );

  assert.deepEqual(
    merged.map((part) => part.type),
    ["reasoning", "text", "tool-driveUploadFile", "text"]
  );
});

test("reasoning preservation coalesces partial stream snapshots", () => {
  const completeReasoning =
    "Creating a file with a short sample line and checking the details.";
  const merged = mergeAssistantMessagePartsWithSuffix(
    [
      { state: "done", text: "Creating a file", type: "reasoning" },
      {
        state: "done",
        text: "Creating a file with a short sample line",
        type: "reasoning",
      },
      { state: "done", text: completeReasoning, type: "reasoning" },
      { text: "I'll create sample.txt.", type: "text" },
      {
        input: { name: "sample.txt" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ],
    [
      { text: "I'll create sample.txt.", type: "text" },
      {
        input: { name: "sample.txt" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ]
  );

  const reasoning = merged.filter((part) => part.type === "reasoning");
  assert.equal(reasoning.length, 1);
  assert.equal(reasoning[0]?.text, completeReasoning);
});

test("active reasoning grows when a longer streaming snapshot arrives", () => {
  const merged = mergeAssistantMessageParts(
    [
      {
        state: "streaming",
        text: "Summarizing project details",
        type: "reasoning",
      },
    ],
    [
      {
        state: "streaming",
        text: "Summarizing project details\n\nI need to summarize the indexed document.",
        type: "reasoning",
      },
      { text: "The project has one indexed document.", type: "text" },
    ]
  );

  const reasoning = merged.find((part) => part.type === "reasoning");
  assert.equal(
    reasoning?.type === "reasoning" ? reasoning.text : undefined,
    "Summarizing project details\n\nI need to summarize the indexed document."
  );
});

test("reasoning preservation keeps one Thought per tool anchor", () => {
  const merged = mergeAssistantMessageParts(
    [
      {
        state: "done",
        text: "Need to decide what content belongs in the file.",
        type: "reasoning",
      },
      { text: "I'll create sample.txt.", type: "text" },
      {
        input: { name: "sample.txt" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ],
    [
      {
        state: "done",
        text: "Creating a file requires choosing a plain-text sample first.",
        type: "reasoning",
      },
      { text: "I'll create sample.txt.", type: "text" },
      {
        input: { name: "sample.txt" },
        state: "approval-requested",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ]
  );

  assert.equal(merged.filter((part) => part.type === "reasoning").length, 1);
  assert.equal(
    merged[0]?.type === "reasoning" ? merged[0].text : undefined,
    "Need to decide what content belongs in the file."
  );
});
