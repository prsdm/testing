import assert from "node:assert/strict";
import test from "node:test";
import {
  persistedTodoNudgeMetadata,
  resolvePrepareStepUserNudge,
} from "@/shared/ai/chat-agent-nudge";

test("persists todo nudge flags only after a successful continuation", () => {
  const attempted = {
    todoExecutionNudged: true,
    todoPendingStepsNudged: true,
  };

  assert.deepEqual(
    persistedTodoNudgeMetadata({
      attempted,
      finishReason: "stop",
      isAborted: false,
    }),
    attempted
  );
  assert.deepEqual(
    persistedTodoNudgeMetadata({
      attempted,
      finishReason: "error",
      isAborted: false,
    }),
    {}
  );
  assert.deepEqual(
    persistedTodoNudgeMetadata({
      attempted,
      finishReason: "stop",
      isAborted: true,
    }),
    {}
  );
});

test("resolvePrepareStepUserNudge injects skip guidance after user rejection", () => {
  const nudge = resolvePrepareStepUserNudge({
    assistantParts: [
      {
        input: { name: "Finance" },
        output: { reason: "Rejected by user", type: "execution-denied" },
        state: "output-denied",
        toolCallId: "drive-1",
        type: "tool-driveCreateFolder",
      },
    ],
    isContinuationTurn: true,
    stepNumber: 0,
  });

  assert.match(nudge ?? "", /rejected the most recent write approval/i);
  assert.match(nudge ?? "", /skipped/i);
});

test("resolvePrepareStepUserNudge injects pending-step nudge on continuation", () => {
  const nudge = resolvePrepareStepUserNudge({
    assistantParts: [
      {
        input: {
          todos: [
            {
              activeForm: "Creating Legal folder",
              content: "Create Legal folder",
              status: "pending",
            },
          ],
        },
        output: {
          todos: [
            {
              activeForm: "Creating Legal folder",
              content: "Create Legal folder",
              status: "pending",
            },
          ],
        },
        state: "output-available",
        toolCallId: "todo-1",
        type: "tool-todoWrite",
      },
      {
        input: { name: "Finance" },
        output: { name: "Finance" },
        state: "output-available",
        toolCallId: "drive-1",
        type: "tool-driveCreateFolder",
      },
      {
        text: "Finance is ready.",
        type: "text",
      },
    ],
    isContinuationTurn: true,
    stepNumber: 0,
  });

  assert.match(nudge ?? "", /Open task plan steps remain/);
  assert.match(nudge ?? "", /Create Legal folder/);
});

test("resolvePrepareStepUserNudge skips pending-step nudge after it was sent", () => {
  const nudge = resolvePrepareStepUserNudge({
    assistantParts: [
      {
        input: {
          todos: [
            {
              activeForm: "Creating Legal folder",
              content: "Create Legal folder",
              status: "pending",
            },
          ],
        },
        output: {
          todos: [
            {
              activeForm: "Creating Legal folder",
              content: "Create Legal folder",
              status: "pending",
            },
          ],
        },
        state: "output-available",
        toolCallId: "todo-1",
        type: "tool-todoWrite",
      },
      {
        input: { name: "Finance" },
        output: { name: "Finance" },
        state: "output-available",
        toolCallId: "drive-1",
        type: "tool-driveCreateFolder",
      },
      {
        text: "Finance is ready.",
        type: "text",
      },
    ],
    isContinuationTurn: true,
    stepNumber: 0,
    todoExecutionNudged: true,
    todoPendingStepsNudged: true,
  });

  assert.equal(nudge, null);
});
