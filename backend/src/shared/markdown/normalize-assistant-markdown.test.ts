import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeMarkdownLists } from "./normalize-assistant-markdown";

describe("normalizeMarkdownLists", () => {
  it("inserts a blank line before list items", () => {
    assert.equal(
      normalizeMarkdownLists("One document:\n- First item"),
      "One document:\n\n- First item"
    );
  });
});
