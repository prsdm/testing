import assert from "node:assert/strict";
import test from "node:test";
import { resolveToolApprovalStep } from "@/core/lib/ai/resolve-tool-approval-step";
import { ChatbotError } from "@/shared/errors";
import type { ChatMessagePart } from "@/shared/types";

test("resolveToolApprovalStep executes approved tools before continuation", async () => {
  const { uiMessages, changed } = await resolveToolApprovalStep({
    tools: {
      peopleSearch: {
        description: "people",
        execute: async () => ({ users: [{ name: "Alex" }] }),
        inputSchema: { type: "object" },
      },
    } as never,
    toolsContext: {
      peopleSearch: {
        input: {} as never,
        workflowRunId: "run-1",
      },
    },
    uiMessages: [
      {
        id: "assistant-1",
        parts: [
          {
            approval: { approved: true, id: "approval-2" },
            input: { query: "alex" },
            originalToolName: "peopleSearch",
            state: "approval-responded",
            toolCallId: "call-1",
            type: "tool-peopleSearch",
          } as never,
        ],
        role: "assistant",
      },
    ],
  });

  assert.equal(changed, true);
  const toolPart = uiMessages[0]?.parts[0] as ChatMessagePart | undefined;
  assert.equal(
    toolPart && "state" in toolPart ? toolPart.state : undefined,
    "output-available"
  );
});

test("resolveToolApprovalStep rejects continuation while approval is pending", async () => {
  await assert.rejects(
    () =>
      resolveToolApprovalStep({
        tools: {} as never,
        toolsContext: {} as never,
        uiMessages: [
          {
            id: "assistant-1",
            parts: [
              {
                approval: { id: "approval-3" },
                input: { query: "news" },
                originalToolName: "webSearch",
                state: "approval-requested",
                toolCallId: "call-web",
                type: "tool-webSearch",
              } as never,
            ],
            role: "assistant",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ChatbotError &&
      error.cause === "Tool approval is still pending for this turn."
  );
});
