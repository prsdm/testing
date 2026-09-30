import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeDocxContentToMarkdown,
  encodeMarkdownAsDocxContent,
  htmlToMarkdown,
  isDocxStoredContent,
  repairMarkdownTables,
  replaceFirstPassage,
  textDocumentFileName,
} from "./text-docx";

describe("textDocumentFileName", () => {
  it("adds .docx extension", () => {
    assert.equal(textDocumentFileName("What is Life"), "What is Life.docx");
  });

  it("replaces markdown extensions", () => {
    assert.equal(textDocumentFileName("notes.md"), "notes.docx");
  });
});

describe("text-docx round trip", () => {
  it("encodes markdown as stored docx content", async () => {
    const stored = await encodeMarkdownAsDocxContent(
      "# Title\n\nHello **world**\n\n- one\n- two"
    );
    assert.ok(isDocxStoredContent(stored));
  });

  it("decodes stored docx back to readable markdown", async () => {
    const stored = await encodeMarkdownAsDocxContent(
      "# Title\n\nHello world\n\n- one"
    );
    const markdown = await decodeDocxContentToMarkdown(stored);
    assert.match(markdown, /Title/);
    assert.match(markdown, /Hello world/);
    assert.match(markdown, /one/);
  });

  it("encodes markdown pipe tables as real Word tables", async () => {
    const markdown = `# Overview

| Perspective | Key Focus | Example |
| --- | --- | --- |
| Biological | Growth | A cell |
| Social | Belonging | A community |
`;
    const stored = await encodeMarkdownAsDocxContent(markdown);
    assert.ok(isDocxStoredContent(stored));
    const roundTrip = await decodeDocxContentToMarkdown(stored);
    assert.match(roundTrip, /Overview/);
    assert.match(roundTrip, /\| Perspective \| Key Focus \| Example \|/);
    assert.match(roundTrip, /\| Biological \| Growth \| A cell \|/);
    assert.match(roundTrip, /\| Social \| Belonging \| A community \|/);
    assert.doesNotMatch(roundTrip, /PerspectiveKey Focus/);
  });

  it("repairs tables that were trapped in code fences", () => {
    const repaired = repairMarkdownTables(`# Title

\`\`\`
| A | B |
| --- | --- |
| 1 | 2 |
\`\`\`
`);
    assert.match(repaired, /\| A \| B \|/);
    assert.doesNotMatch(repaired, /```/);
  });
});

describe("htmlToMarkdown", () => {
  it("converts headings and paragraphs", () => {
    const markdown = htmlToMarkdown(
      "<h1>Title</h1><p>Hello <strong>world</strong></p><ul><li>one</li></ul>"
    );
    assert.match(markdown, /^# Title/m);
    assert.match(markdown, /Hello \*\*world\*\*/);
    assert.match(markdown, /^- one/m);
  });
});

describe("replaceFirstPassage", () => {
  it("replaces an exact markdown passage", () => {
    const next = replaceFirstPassage(
      "# Title\n\nHello world\n\nTail",
      "Hello world",
      "Hi earth"
    );
    assert.equal(next, "# Title\n\nHi earth\n\nTail");
  });

  it("matches across whitespace differences", () => {
    const next = replaceFirstPassage(
      "Alpha\n\nBeta gamma\n\nDelta",
      "Beta   gamma",
      "Beta replaced"
    );
    assert.equal(next, "Alpha\n\nBeta replaced\n\nDelta");
  });

  it("returns null when the passage is missing", () => {
    assert.equal(replaceFirstPassage("Hello", "missing", "x"), null);
  });
});
