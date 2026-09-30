import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractAssistantReplyText, stripBotMention } from "./extract-reply";

describe("stripBotMention", () => {
  it("removes the leading bot mention", () => {
    assert.equal(
      stripBotMention("<@U123> summarize Q3", "U123"),
      "summarize Q3"
    );
  });
});

describe("extractAssistantReplyText", () => {
  it("returns final answer text after tools", () => {
    const text = extractAssistantReplyText([
      { state: "output-available", toolCallId: "1", type: "tool-sourceSearch" },
      { text: "Here is the summary.", type: "text" },
    ] as never);
    assert.equal(text, "Here is the summary.");
  });
});
