import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ModelMessage } from "ai";
import { CONTEXT_COMPACTION_THRESHOLD_TOKENS } from "@/shared/ai/context-harness/constants";
import { estimateTokensFromText } from "@/shared/ai/context-harness/token-estimate";
import { truncateContextForLlm } from "@/shared/ai/context-harness/truncate-context-for-llm";
import { truncateToolResultsInModelMessages } from "@/shared/ai/context-harness/truncate-tool-results";
import {
  buildCompactionSummaryMessage,
  COMPACTION_SUMMARY_PREFIX,
  compactModelMessagesIfNeeded,
  shouldCompactModelContext,
  splitMessagesForCompaction,
} from "./compact-model-messages";

describe("context-harness token estimate", () => {
  it("estimates tokens from char length", () => {
    assert.equal(estimateTokensFromText("abcd"), 1);
    assert.equal(estimateTokensFromText("a".repeat(400)), 100);
  });
});

describe("truncateContextForLlm", () => {
  it("returns short text unchanged", () => {
    assert.equal(truncateContextForLlm("hello"), "hello");
  });

  it("truncates long text with head and tail preview", () => {
    const long = "x".repeat(30_000);
    const truncated = truncateContextForLlm(long, 100);
    assert.match(truncated, /^\w+\n… \[truncated ~\d+ tokens/);
    assert.match(truncated, /…\n\w+$/);
    assert.ok(truncated.length < long.length);
  });
});

describe("truncateToolResultsInModelMessages", () => {
  it("truncates contextForLlm inside tool results", () => {
    const huge = "y".repeat(30_000);
    const messages: ModelMessage[] = [
      {
        content: [
          {
            output: {
              type: "json",
              value: { contextForLlm: huge, ok: true },
            },
            toolCallId: "call-1",
            toolName: "search",
            type: "tool-result",
          },
        ],
        role: "tool",
      },
    ];

    const truncated = truncateToolResultsInModelMessages(messages);
    const part = truncated[0]?.content;
    assert.ok(Array.isArray(part));
    const output = (
      part[0] as { output?: { value?: { contextForLlm?: string } } }
    ).output?.value;
    assert.ok(output?.contextForLlm);
    assert.ok(output.contextForLlm.length < huge.length);
    assert.match(output.contextForLlm, /truncated/);
  });
});

describe("compactModelMessagesIfNeeded", () => {
  it("does not compact when under threshold", async () => {
    const messages: ModelMessage[] = [
      { content: "hi", role: "user" },
      { content: "hello", role: "assistant" },
    ];
    assert.equal(
      shouldCompactModelContext({ messages, systemText: "sys" }),
      false
    );
    const result = await compactModelMessagesIfNeeded({
      messages,
      systemText: "sys",
    });
    assert.deepEqual(result, messages);
  });

  it("compacts older messages and keeps recent ones", async () => {
    const messages: ModelMessage[] = Array.from({ length: 12 }, (_, index) => ({
      content: `message-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
    }));

    const result = await compactModelMessagesIfNeeded({
      messages,
      summarize: async () => "Earlier work summary.",
      systemText: "x".repeat(CONTEXT_COMPACTION_THRESHOLD_TOKENS * 4),
    });

    assert.equal(result.length, 9);
    assert.equal(result[0]?.role, "user");
    const summaryText =
      typeof result[0]?.content === "string" ? result[0].content : "";
    assert.ok(summaryText.includes(COMPACTION_SUMMARY_PREFIX));
    assert.ok(summaryText.includes("Earlier work summary"));
    assert.equal(result.at(-1)?.content, "message-11");
  });

  it("splits messages for compaction", () => {
    const messages: ModelMessage[] = [
      { content: "1", role: "user" },
      { content: "2", role: "assistant" },
      { content: "3", role: "user" },
    ];
    const { older, recent } = splitMessagesForCompaction(messages, 2);
    assert.deepEqual(older, [{ content: "1", role: "user" }]);
    assert.deepEqual(recent, [
      { content: "2", role: "assistant" },
      { content: "3", role: "user" },
    ]);
  });

  it("builds a summary message", () => {
    const message = buildCompactionSummaryMessage("facts");
    assert.equal(message.role, "user");
    assert.match(String(message.content), /facts/);
  });
});
