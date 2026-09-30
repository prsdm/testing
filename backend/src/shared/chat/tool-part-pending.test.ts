import assert from "node:assert/strict";
import test from "node:test";
import {
  isInterruptedToolForDisplay,
  isToolPartPendingForDisplay,
} from "./tool-part-pending";

test("isInterruptedToolForDisplay marks in-flight tools after streaming stops", () => {
  assert.equal(
    isInterruptedToolForDisplay({
      isMessageStreaming: false,
      state: "input-available",
    }),
    true
  );
  assert.equal(
    isInterruptedToolForDisplay({
      isMessageStreaming: true,
      state: "input-available",
    }),
    false
  );
});

test("isInterruptedToolForDisplay marks output-available parts missing output", () => {
  assert.equal(
    isInterruptedToolForDisplay({
      hasOutput: false,
      isMessageStreaming: false,
      state: "output-available",
    }),
    true
  );
  assert.equal(
    isInterruptedToolForDisplay({
      hasOutput: true,
      isMessageStreaming: false,
      state: "output-available",
    }),
    false
  );
});

test("isToolPartPendingForDisplay does not treat interrupted tools as pending", () => {
  assert.equal(
    isToolPartPendingForDisplay({
      isMessageStreaming: false,
      state: "input-available",
    }),
    false
  );
});
