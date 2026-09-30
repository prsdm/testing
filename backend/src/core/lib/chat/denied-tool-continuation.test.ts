import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantTurnAwaitingPostDenialContinuation,
  assistantTurnAwaitingPostUserRejectionContinuation,
} from "@/shared/chat/denied-tool-suffix";
import { mergeAssistantMessageMetadata } from "@/shared/chat/merge-workflow-chat-messages";

test("assistantTurnAwaitingPostDenialContinuation is true after a lone rejection", () => {
  assert.equal(
    assistantTurnAwaitingPostDenialContinuation([
      {
        input: { name: "summary.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ]),
    true
  );
});

test("assistantTurnAwaitingPostUserRejectionContinuation is true for user rejections", () => {
  assert.equal(
    assistantTurnAwaitingPostUserRejectionContinuation([
      {
        input: { name: "Finance" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveCreateFolder",
      },
    ]),
    true
  );
});

test("assistantTurnAwaitingPostUserRejectionContinuation is false after a later successful write", () => {
  assert.equal(
    assistantTurnAwaitingPostUserRejectionContinuation([
      {
        input: { name: "Finance" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveCreateFolder",
      },
      {
        input: { name: "HR" },
        output: { id: "folder-hr", name: "HR" },
        state: "output-available",
        toolCallId: "call-2",
        type: "tool-driveCreateFolder",
      },
    ]),
    false
  );
});

test("assistantTurnAwaitingPostDenialContinuation is false once a final answer follows", () => {
  assert.equal(
    assistantTurnAwaitingPostDenialContinuation([
      {
        input: { query: "earnings" },
        output: { documents: [] },
        state: "output-available",
        toolCallId: "search-1",
        type: "tool-sourceSearch",
      },
      {
        input: { name: "summary.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
      {
        text: "The document-creation action was rejected, so I can't complete the Drive save from this session.",
        type: "text",
      },
    ]),
    false
  );
});

test("mergeAssistantMessageMetadata keeps local running while awaiting post-denial answer", () => {
  const metadata = mergeAssistantMessageMetadata(
    { workflowRunStatus: "running" },
    { workflowRunStatus: "success" },
    [
      {
        input: { name: "summary.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
    ]
  );

  assert.equal(metadata?.workflowRunStatus, "running");
});

test("mergeAssistantMessageMetadata marks success once a final answer follows rejection", () => {
  const metadata = mergeAssistantMessageMetadata(
    { workflowRunStatus: "running" },
    { workflowRunStatus: "success" },
    [
      {
        input: { name: "summary.txt" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "call-1",
        type: "tool-driveUploadFile",
      },
      {
        text: "The document-creation action was rejected, so I can't complete the Drive save from this session.",
        type: "text",
      },
    ]
  );

  assert.equal(metadata?.workflowRunStatus, "success");
});
