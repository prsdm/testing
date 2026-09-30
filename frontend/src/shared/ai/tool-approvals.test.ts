import assert from "node:assert/strict";
import test from "node:test";
import {
  collectUserRejectedApprovalAttempts,
  collectUserRejectedApprovalToolNames,
  hashToolApprovalInput,
  isUserRejectedApprovalRetry,
  isWriteToolName,
  resolveApprovalToolGateForTurn,
  toolAllowedForTurn,
  toolRequiresApproval,
} from "./tool-approvals";

test("detects connector write tools", () => {
  assert.equal(isWriteToolName("drive__uploadFile"), true);
  assert.equal(isWriteToolName("jira_transition_issue"), true);
  assert.equal(isWriteToolName("peopleSearch"), false);
});

test("every write tool requires approval", () => {
  assert.equal(toolRequiresApproval({ toolName: "drive__uploadFile" }), true);
  assert.equal(toolRequiresApproval({ toolName: "drive__listFiles" }), false);
  assert.equal(toolRequiresApproval({ toolName: "driveListFolders" }), false);
  assert.equal(toolRequiresApproval({ toolName: "driveSearchFiles" }), false);
  assert.equal(toolRequiresApproval({ toolName: "driveGetFile" }), false);
});

test("toolAllowedForTurn blocks approval-gated tools by name", () => {
  assert.equal(
    toolAllowedForTurn({
      blockedApprovalToolNames: ["drive__uploadFile"],
      toolName: "drive__uploadFile",
    }),
    false
  );
  assert.equal(
    toolAllowedForTurn({
      blockedApprovalToolNames: ["drive__uploadFile"],
      toolName: "drive__listFiles",
    }),
    true
  );
  assert.equal(
    toolAllowedForTurn({
      toolName: "drive__uploadFile",
      writeToolsBlocked: true,
    }),
    false
  );
});

test("collectUserRejectedApprovalToolNames tracks any user-declined approval tool", () => {
  assert.deepEqual(
    collectUserRejectedApprovalToolNames([
      {
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        type: "tool-driveUploadFile",
      },
    ]),
    ["driveUploadFile"]
  );
  assert.deepEqual(
    collectUserRejectedApprovalToolNames([
      {
        output: { error: "Drive API failed" },
        state: "output-error",
        type: "tool-driveUploadFile",
      },
    ]),
    []
  );
});

test("hashToolApprovalInput is stable regardless of key order", () => {
  assert.equal(
    hashToolApprovalInput({ name: "Finance", parentId: "root" }),
    hashToolApprovalInput({ name: "Finance", parentId: "root" })
  );
});

test("collectUserRejectedApprovalAttempts tracks exact tool and input", () => {
  assert.deepEqual(
    collectUserRejectedApprovalAttempts([
      {
        input: { name: "Finance" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        type: "tool-driveCreateFolder",
      },
    ]),
    [
      {
        inputKey: hashToolApprovalInput({ name: "Finance" }),
        toolName: "driveCreateFolder",
      },
    ]
  );
});

test("isUserRejectedApprovalRetry matches only the same tool and input", () => {
  const attempts = collectUserRejectedApprovalAttempts([
    {
      input: { name: "Finance" },
      output: { reason: "Rejected by user", type: "execution-denied" },
      state: "output-denied",
      type: "tool-driveCreateFolder",
    },
  ]);

  assert.equal(
    isUserRejectedApprovalRetry({
      attempts,
      input: { name: "Finance" },
      toolName: "driveCreateFolder",
    }),
    true
  );
  assert.equal(
    isUserRejectedApprovalRetry({
      attempts,
      input: { name: "Legal" },
      toolName: "driveCreateFolder",
    }),
    false
  );
});

test("resolveApprovalToolGateForTurn keeps explicit blocks and records rejected attempts", () => {
  assert.deepEqual(
    resolveApprovalToolGateForTurn({
      assistantParts: [
        {
          input: { name: "Finance" },
          output: { reason: "Rejected by user", type: "execution-denied" },
          state: "output-denied",
          type: "tool-driveCreateFolder",
        },
      ],
      blockedApprovalToolNames: ["gmail__sendMessage"],
    }),
    {
      blockedApprovalToolNames: ["gmail__sendMessage"],
      userRejectedApprovalAttempts: [
        {
          inputKey: hashToolApprovalInput({ name: "Finance" }),
          toolName: "driveCreateFolder",
        },
      ],
      writeToolsBlocked: false,
    }
  );
});

test("driveCreateFolder stays available for a different folder after one rejection", () => {
  const gate = resolveApprovalToolGateForTurn({
    assistantParts: [
      {
        input: { name: "Finance" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        type: "tool-driveCreateFolder",
      },
    ],
  });
  assert.equal(
    toolAllowedForTurn({
      blockedApprovalToolNames: gate.blockedApprovalToolNames,
      toolName: "driveCreateFolder",
    }),
    true
  );
  assert.equal(
    isUserRejectedApprovalRetry({
      attempts: gate.userRejectedApprovalAttempts,
      input: { name: "Finance" },
      toolName: "driveCreateFolder",
    }),
    true
  );
  assert.equal(
    isUserRejectedApprovalRetry({
      attempts: gate.userRejectedApprovalAttempts,
      input: { name: "Legal" },
      toolName: "driveCreateFolder",
    }),
    false
  );
});
