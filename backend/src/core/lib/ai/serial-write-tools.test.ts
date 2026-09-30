import assert from "node:assert/strict";
import test from "node:test";
import {
  createSerialWriteStepTracker,
  resolveMutatingToolNeedsApproval,
  resolveSerialWriteToolApproval,
  SERIAL_WRITE_LIMIT_REASON,
} from "@/core/lib/ai/serial-write-tools";

test("resolveSerialWriteToolApproval allows the first mutating tool in a step", () => {
  const tracker = createSerialWriteStepTracker();
  tracker.resetForStep();

  assert.equal(
    resolveSerialWriteToolApproval({
      input: { channel: "C1", text: "Hi" },
      toolName: "slack__sendMessage",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    "user-approval"
  );
});

test("resolveSerialWriteToolApproval denies a second mutating tool in the same step", () => {
  const tracker = createSerialWriteStepTracker();
  tracker.resetForStep();

  assert.equal(
    resolveSerialWriteToolApproval({
      input: { channel: "C1", text: "Hi" },
      toolName: "slack__sendMessage",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    "user-approval"
  );

  assert.deepEqual(
    resolveSerialWriteToolApproval({
      input: { body: "Hello", subject: "Hi", to: "a@example.com" },
      toolName: "gmail__sendEmail",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    { reason: SERIAL_WRITE_LIMIT_REASON, type: "denied" }
  );
});

test("resolveSerialWriteToolApproval resets between steps", () => {
  const tracker = createSerialWriteStepTracker();
  tracker.resetForStep();

  resolveSerialWriteToolApproval({
    input: { channel: "C1", text: "Hi" },
    toolName: "slack__sendMessage",
    tracker,
    userRejectedApprovalAttempts: [],
  });

  tracker.resetForStep();

  assert.equal(
    resolveSerialWriteToolApproval({
      input: { body: "Hello", subject: "Hi", to: "a@example.com" },
      toolName: "gmail__sendEmail",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    "user-approval"
  );
});

test("resolveSerialWriteToolApproval leaves read tools not-applicable", () => {
  const tracker = createSerialWriteStepTracker();
  tracker.resetForStep();

  assert.equal(
    resolveSerialWriteToolApproval({
      input: { query: "budget" },
      toolName: "slack__searchMessages",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    "not-applicable"
  );
});

test("resolveSerialWriteToolApproval allows parallel reads with one write", () => {
  const tracker = createSerialWriteStepTracker();
  tracker.resetForStep();

  assert.equal(
    resolveSerialWriteToolApproval({
      input: { query: "budget" },
      toolName: "slack__searchMessages",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    "not-applicable"
  );
  assert.equal(
    resolveSerialWriteToolApproval({
      input: { query: "budget" },
      toolName: "gmail__searchMessages",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    "not-applicable"
  );
  assert.equal(
    resolveSerialWriteToolApproval({
      input: { channel: "C1", text: "Hi" },
      toolName: "slack__sendMessage",
      tracker,
      userRejectedApprovalAttempts: [],
    }),
    "user-approval"
  );
});

test("resolveMutatingToolNeedsApproval skips approval for exact rejected retries", () => {
  const attempts = [
    {
      inputKey: "abc123",
      toolName: "slack__sendMessage",
    },
  ];

  assert.equal(
    resolveMutatingToolNeedsApproval({
      attempts,
      input: { query: "alice" },
      toolName: "peopleSearch",
    }),
    false
  );
});
