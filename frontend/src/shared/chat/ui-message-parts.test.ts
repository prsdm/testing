import assert from "node:assert/strict";
import test from "node:test";
import {
  pendingToolApprovalFromParts,
  pendingToolApprovalFromToolPart,
} from "./ui-message-parts";

test("pendingToolApprovalFromToolPart reads approval from tool part", () => {
  assert.deepEqual(
    pendingToolApprovalFromToolPart({
      approval: { id: "approval-1" },
      input: { name: "notes.txt" },
      state: "approval-requested",
      toolCallId: "call-1",
      type: "tool-driveUploadFile",
    }),
    {
      approvalId: "approval-1",
      args: { name: "notes.txt" },
      toolCallId: "call-1",
      toolName: "driveUploadFile",
    }
  );
});

test("pendingToolApprovalFromParts returns first pending approval", () => {
  assert.deepEqual(
    pendingToolApprovalFromParts([
      {
        output: { users: [] },
        state: "output-available",
        toolCallId: "call-read",
        type: "tool-slackListUsers",
      },
      {
        approval: { id: "approval-2" },
        input: { name: "folder" },
        state: "approval-requested",
        toolCallId: "call-write",
        type: "tool-driveCreateFolder",
      },
    ]),
    {
      approvalId: "approval-2",
      args: { name: "folder" },
      toolCallId: "call-write",
      toolName: "driveCreateFolder",
    }
  );
});
