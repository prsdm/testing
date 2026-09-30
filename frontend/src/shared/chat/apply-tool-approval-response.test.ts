import assert from "node:assert/strict";
import test from "node:test";
import {
  applyToolApprovalResponseToMessages,
  messageHasInlineToolApproval,
} from "@/shared/chat/apply-tool-approval-response";
import { isConnectionActionToolPending } from "@/shared/chat/connector-action-tools";

test("approval-requested connector tools stay pending until approved", () => {
  assert.equal(
    isConnectionActionToolPending({
      state: "approval-requested",
      type: "tool-driveUploadFile",
    }),
    true
  );
  assert.equal(
    isConnectionActionToolPending({
      state: "input-available",
      type: "tool-driveUploadFile",
    }),
    true
  );
});

test("applyToolApprovalResponseToMessages clears pending approval on reject", () => {
  const next = applyToolApprovalResponseToMessages(
    [
      {
        id: "assistant-1",
        metadata: {
          pendingToolApproval: {
            approvalId: "approval-call-1",
            args: { name: "sample.txt" },
            toolCallId: "call-1",
            toolName: "driveUploadFile",
          },
          workflowRunStatus: "suspended",
        },
        parts: [
          { text: "I'll create sample.txt in Drive.", type: "text" },
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
    {
      approvalId: "approval-call-1",
      approved: false,
      reason: "Rejected by user",
    }
  );

  const assistant = next[0];
  const toolPart = assistant?.parts[1];
  assert.equal(assistant?.metadata?.pendingToolApproval, undefined);
  assert.equal(assistant?.metadata?.workflowRunStatus, "running");
  assert.equal(
    toolPart && "state" in toolPart ? toolPart.state : undefined,
    "output-denied"
  );
  assert.equal(assistant?.parts.length, 2);
});

test("applyToolApprovalResponseToMessages keeps pending approval for parallel tools", () => {
  const next = applyToolApprovalResponseToMessages(
    [
      {
        id: "assistant-1",
        metadata: {
          pendingToolApproval: {
            approvalId: "approval-search",
            toolCallId: "call-search",
            toolName: "knowledgeBaseSearch",
          },
          workflowRunStatus: "suspended",
        },
        parts: [
          {
            approval: { id: "approval-search" },
            input: { query: "earnings" },
            state: "approval-requested",
            toolCallId: "call-search",
            type: "tool-knowledgeBaseSearch",
          },
          {
            approval: { id: "approval-gmail" },
            input: { query: "earnings" },
            state: "approval-requested",
            toolCallId: "call-gmail",
            type: "tool-gmailSearchMessages",
          },
        ],
        role: "assistant",
      },
    ],
    {
      approvalId: "approval-search",
      approved: true,
    }
  );

  const assistant = next[0];
  assert.equal(assistant?.metadata?.workflowRunStatus, "suspended");
  assert.equal(
    assistant?.metadata?.pendingToolApproval?.toolCallId,
    "call-gmail"
  );
  assert.equal(
    assistant?.parts[0] && "state" in assistant.parts[0]
      ? assistant.parts[0].state
      : undefined,
    "approval-responded"
  );
});

test("applyToolApprovalResponseToMessages clears persisted approval on approve", () => {
  const next = applyToolApprovalResponseToMessages(
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
    {
      approvalId: "approval-call-1",
      approved: true,
    }
  );

  const assistant = next[0];
  const toolPart = assistant?.parts[0];
  assert.equal(assistant?.metadata?.pendingToolApproval, undefined);
  assert.equal(assistant?.metadata?.workflowRunStatus, "running");
  assert.equal(
    toolPart && "state" in toolPart ? toolPart.state : undefined,
    "approval-responded"
  );
});

test("messageHasInlineToolApproval matches suspended tool rows", () => {
  const message = {
    id: "assistant-1",
    metadata: {
      pendingToolApproval: {
        approvalId: "approval-call-1",
        toolCallId: "call-1",
        toolName: "driveUploadFile",
      },
    },
    parts: [
      {
        approval: { id: "approval-call-1" },
        input: { name: "sample.txt" },
        state: "approval-requested" as const,
        toolCallId: "call-1",
        type: "tool-driveUploadFile" as const,
      },
    ],
    role: "assistant" as const,
  };

  assert.equal(messageHasInlineToolApproval(message), true);
});
