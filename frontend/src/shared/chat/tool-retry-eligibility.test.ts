import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "@/shared/types";
import {
  isAssistantMessageEligibleForToolRetry,
  isConnectorToolTerminalForRetry,
  isToolTerminalForRetry,
  shouldOfferConnectorToolRetry,
  shouldOfferToolRetry,
  toolRetryLabel,
  toolRetryNeedsApproval,
} from "./tool-retry-eligibility";

test("isToolTerminalForRetry accepts finished search tool parts", () => {
  assert.equal(
    isToolTerminalForRetry({
      input: { query: "news" },
      output: { query: "news", results: [] },
      state: "output-available",
      toolCallId: "call-web",
      type: "tool-webSearch",
    }),
    true
  );
});

test("isConnectorToolTerminalForRetry only accepts connector tools", () => {
  assert.equal(
    isConnectorToolTerminalForRetry({
      output: { query: "news", results: [] },
      state: "output-available",
      toolCallId: "call-web",
      type: "tool-webSearch",
    }),
    false
  );
  assert.equal(
    isConnectorToolTerminalForRetry({
      output: { id: "file-1" },
      state: "output-available",
      toolCallId: "call-1",
      type: "tool-driveUploadFile",
    }),
    true
  );
});

test("shouldOfferToolRetry offers Run again for successful search tools", () => {
  const part = {
    input: { query: "news" },
    output: {
      query: "news",
      results: [{ snippet: "", title: "A", url: "https://a" }],
    },
    state: "output-available" as const,
    toolCallId: "call-web",
    type: "tool-webSearch" as const,
  };
  assert.equal(shouldOfferToolRetry(part), true);
  assert.equal(toolRetryLabel(part), "Run again");
});

test("shouldOfferConnectorToolRetry offers Run again only for successful write tools", () => {
  assert.equal(
    shouldOfferConnectorToolRetry({
      output: { id: "file-1" },
      state: "output-available",
      toolCallId: "call-1",
      type: "tool-driveUploadFile",
    }),
    true
  );
  assert.equal(
    shouldOfferConnectorToolRetry({
      output: { users: [] },
      state: "output-available",
      toolCallId: "call-2",
      type: "tool-slackListUsers",
    }),
    false
  );
});

test("shouldOfferToolRetry offers Retry for failed read tools", () => {
  assert.equal(
    shouldOfferToolRetry({
      errorText: "Slack API failed",
      state: "output-error",
      toolCallId: "call-2",
      type: "tool-slackListUsers",
    }),
    true
  );
  assert.equal(
    shouldOfferToolRetry({
      output: { error: "Search failed" },
      state: "output-available",
      toolCallId: "call-3",
      type: "tool-slackSearchMessages",
    }),
    true
  );
});

test("isAssistantMessageEligibleForToolRetry allows only the current assistant turn", () => {
  const assistantId = "assistant-1";
  const messages: ChatMessage[] = [
    { id: "user-1", parts: [{ text: "Hi", type: "text" }], role: "user" },
    {
      id: assistantId,
      parts: [
        {
          input: { query: "news" },
          output: { query: "news", results: [] },
          state: "output-available",
          toolCallId: "web-1",
          type: "tool-webSearch",
        },
      ],
      role: "assistant",
    },
  ];
  assert.equal(
    isAssistantMessageEligibleForToolRetry(messages, assistantId),
    true
  );

  messages.push({
    id: "user-2",
    parts: [{ text: "Follow up", type: "text" }],
    role: "user",
  });
  assert.equal(
    isAssistantMessageEligibleForToolRetry(messages, assistantId),
    false
  );

  messages.push({
    id: "assistant-2",
    parts: [{ text: "Another answer.", type: "text" }],
    role: "assistant",
  });
  assert.equal(
    isAssistantMessageEligibleForToolRetry(messages, "assistant-2"),
    true
  );
  assert.equal(
    isAssistantMessageEligibleForToolRetry(messages, assistantId),
    false
  );
});

test("toolRetryNeedsApproval is true only for connector writes", () => {
  assert.equal(toolRetryNeedsApproval("driveUploadFile"), true);
  assert.equal(toolRetryNeedsApproval("slackListUsers"), false);
  assert.equal(toolRetryNeedsApproval("webSearch"), false);
  assert.equal(toolRetryNeedsApproval("createChart"), false);
});
