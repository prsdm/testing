import assert from "node:assert/strict";
import test from "node:test";
import {
  appendRegisteredOptimisticMessage,
  applyRegisteredToolApproval,
  applyRegisteredWorkflowSnapshot,
  getRegisteredChatSnapshot,
  hydrateRegisteredMessages,
} from "./chat-registry";

test("workflow snapshots update by message id without changing chronology", () => {
  const chatId = "registry-chronology";
  appendRegisteredOptimisticMessage(chatId, {
    id: "user-1",
    parts: [{ text: "Create a file", type: "text" }],
    role: "user",
  });

  applyRegisteredWorkflowSnapshot(
    chatId,
    [
      {
        id: "assistant-1",
        parts: [{ text: "I'll create it.", type: "text" }],
        role: "assistant",
      },
      {
        id: "user-1",
        parts: [{ text: "Create a file", type: "text" }],
        role: "user",
      },
    ],
    "streaming"
  );

  assert.deepEqual(
    getRegisteredChatSnapshot(chatId).messages.map((message) => message.id),
    ["user-1", "assistant-1"]
  );
});

test("stale workflow snapshots cannot undo a rejected tool", () => {
  const chatId = "registry-rejection";
  applyRegisteredWorkflowSnapshot(
    chatId,
    [
      {
        id: "assistant-1",
        metadata: {
          pendingToolApproval: {
            approvalId: "approval-1",
            toolCallId: "call-1",
            toolName: "driveUploadFile",
          },
          workflowRunStatus: "suspended",
        },
        parts: [
          {
            approval: { id: "approval-1" },
            input: { name: "sample.txt" },
            state: "approval-requested",
            toolCallId: "call-1",
            type: "tool-driveUploadFile",
          },
        ],
        role: "assistant",
      },
    ],
    "ready"
  );
  applyRegisteredToolApproval(chatId, {
    approvalId: "approval-1",
    approved: false,
    reason: "No",
  });

  applyRegisteredWorkflowSnapshot(
    chatId,
    [
      {
        id: "assistant-1",
        metadata: {
          pendingToolApproval: {
            approvalId: "approval-1",
            toolCallId: "call-1",
            toolName: "driveUploadFile",
          },
          workflowRunStatus: "suspended",
        },
        parts: [
          {
            approval: { id: "approval-1" },
            input: { name: "sample.txt" },
            state: "approval-requested",
            toolCallId: "call-1",
            type: "tool-driveUploadFile",
          },
        ],
        role: "assistant",
      },
    ],
    "streaming"
  );

  const assistant = getRegisteredChatSnapshot(chatId).messages[0];
  const tool = assistant?.parts[0];
  assert.equal(
    tool && "state" in tool ? tool.state : undefined,
    "output-denied"
  );
  assert.equal(assistant?.metadata?.pendingToolApproval, undefined);
});

test("hydration rejects a snapshot after the observed local version changes", () => {
  const chatId = "registry-hydration-version";
  appendRegisteredOptimisticMessage(chatId, {
    id: "user-1",
    parts: [{ text: "Initial", type: "text" }],
    role: "user",
  });
  const observedVersion = getRegisteredChatSnapshot(chatId).version;
  appendRegisteredOptimisticMessage(chatId, {
    id: "user-2",
    parts: [{ text: "Newer local message", type: "text" }],
    role: "user",
  });

  const result = hydrateRegisteredMessages({
    chatId,
    expectedVersion: observedVersion,
    serverMessages: [
      {
        id: "user-1",
        parts: [{ text: "Initial", type: "text" }],
        role: "user",
      },
    ],
  });

  assert.equal(result, null);
  assert.deepEqual(
    getRegisteredChatSnapshot(chatId).messages.map((message) => message.id),
    ["user-1", "user-2"]
  );
});
