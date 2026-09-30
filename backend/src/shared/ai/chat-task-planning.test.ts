import assert from "node:assert/strict";
import test from "node:test";
import {
  createChatPrepareStep,
  latestUserMessageText,
  shouldExposeConnectorTool,
  userMessageNeedsTaskPlan,
  userMessageRequestsSharedDrive,
} from "./chat-task-planning";

test("userMessageNeedsTaskPlan detects sequential multi-step requests", () => {
  assert.equal(
    userMessageNeedsTaskPlan(
      "Create Drive folders Finance, Legal, and HR one after another."
    ),
    true
  );
  assert.equal(
    userMessageNeedsTaskPlan("Create a Finance folder in my Drive root."),
    false
  );
});

test("userMessageRequestsSharedDrive matches explicit shared drive asks", () => {
  assert.equal(
    userMessageRequestsSharedDrive("Create a shared drive Legal"),
    true
  );
  assert.equal(userMessageRequestsSharedDrive("Create folder Legal"), false);
});

test("latestUserMessageText reads the newest user turn", () => {
  assert.equal(
    latestUserMessageText([
      { content: "First", role: "user" },
      { content: "Ok", role: "assistant" },
      {
        content: [{ text: "Create Finance and Legal folders", type: "text" }],
        role: "user",
      },
    ]),
    "Create Finance and Legal folders"
  );
});

test("createChatPrepareStep forces todoWrite on the first step only", () => {
  const prepare = createChatPrepareStep({
    assistantParts: [],
    assistantPartsHaveTodoPlan: false,
    isContinuationTurn: false,
    userMessageText: "Create folders Finance, Legal, and HR one after another.",
  });

  assert.deepEqual(
    prepare({ messages: [], stepNumber: 0, steps: [] } as never),
    {
      messages: [],
      toolChoice: { toolName: "todoWrite", type: "tool" },
    }
  );
  assert.deepEqual(
    prepare({ messages: [], stepNumber: 1, steps: [{ toolCalls: [] }] }),
    { messages: [] }
  );
});

test("shouldExposeConnectorTool gates shared drive creation", () => {
  assert.equal(
    shouldExposeConnectorTool({
      toolId: "driveCreateSharedDrive",
      userMessageText: "Create folder Finance",
    }),
    false
  );
  assert.equal(
    shouldExposeConnectorTool({
      toolId: "driveCreateSharedDrive",
      userMessageText: "Create a shared drive called Legal",
    }),
    true
  );
});

test("createChatPrepareStep skips forced planning when a plan already exists", () => {
  const prepare = createChatPrepareStep({
    assistantParts: [],
    assistantPartsHaveTodoPlan: true,
    isContinuationTurn: false,
    userMessageText: "Create folders Finance, Legal, and HR one after another.",
  });

  assert.deepEqual(
    prepare({ messages: [], stepNumber: 0, steps: [] } as never),
    { messages: [] }
  );
});
