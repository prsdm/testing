import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMessageSearchSnippet,
  messagePlainTextFromRow,
} from "./room-message-search-snippet";

describe("room-message-search-snippet", () => {
  it("extracts text and composerText", () => {
    assert.equal(
      messagePlainTextFromRow({
        metadata: { composerText: "@Kimiro hello" },
        parts: [{ text: "hello", type: "text" }],
      }),
      "hello\n@Kimiro hello"
    );
  });

  it("builds snippet around the match", () => {
    const snippet = buildMessageSearchSnippet({
      query: "banana",
      text: "We discussed apples, bananas, and cherries in the standup.",
    });
    assert.match(snippet.toLowerCase(), /banana/);
  });
});
