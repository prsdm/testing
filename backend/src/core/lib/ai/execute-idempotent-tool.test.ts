import assert from "node:assert/strict";
import test from "node:test";
import { replayCompletedToolExecution } from "./tool-execution-replay";

test("replays a completed mutating tool result without executing again", () => {
  const result = replayCompletedToolExecution<{ id: string }>(
    {
      inputHash: "same-input",
      result: { id: "document-1" },
      status: "completed",
      toolName: "createDocument",
    },
    { inputHash: "same-input", toolName: "createDocument" }
  );

  assert.deepEqual(result, { id: "document-1" });
});

test("fails closed when a tool call id is reused with different input", () => {
  assert.throws(
    () =>
      replayCompletedToolExecution(
        {
          inputHash: "first-input",
          result: { id: "document-1" },
          status: "completed",
          toolName: "createDocument",
        },
        { inputHash: "changed-input", toolName: "createDocument" }
      ),
    /retried with different input/
  );
});
