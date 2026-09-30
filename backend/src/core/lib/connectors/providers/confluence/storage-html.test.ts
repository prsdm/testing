import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendStorageHtml,
  mergePageStorageHtml,
  toStorageHtml,
} from "./storage-html";

describe("confluence storage html", () => {
  it("converts plain text to storage html", () => {
    assert.equal(toStorageHtml("Hello\nWorld"), "<p>Hello<br/>World</p>");
  });

  it("appends new paragraphs without replacing existing content", () => {
    const merged = appendStorageHtml("<p>Existing</p>", "More");
    assert.match(merged, /Existing/);
    assert.match(merged, /More/);
  });

  it("replaces body when contentMode is replace", () => {
    const merged = mergePageStorageHtml({
      content: "Fresh",
      contentMode: "replace",
      existingHtml: "<p>Existing</p>",
    });
    assert.equal(merged, "<p>Fresh</p>");
  });
});
