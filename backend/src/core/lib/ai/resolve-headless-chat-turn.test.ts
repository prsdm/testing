import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveHeadlessChatReasoningEffort } from "./resolve-headless-chat-reasoning";

describe("resolveHeadlessChatReasoningEffort", () => {
  it("enables catalog reasoning for luna instead of leaving it off", () => {
    assert.equal(
      resolveHeadlessChatReasoningEffort("openai/gpt-5.6-luna"),
      "medium"
    );
  });

  it("returns off for non-reasoning models", () => {
    assert.equal(resolveHeadlessChatReasoningEffort("openai/gpt-4o"), "off");
  });
});
