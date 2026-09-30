import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSlackReplyBlocks,
  buildSlackReplyPresentation,
  convertMarkdownToSlackMrkdwn,
  formatSlackReplyText,
  SLACK_MESSAGE_MAX_LEN,
  stripInlineCitationMarkers,
} from "./format-slack-reply";

describe("formatSlackReplyText", () => {
  it("returns null when reply is empty", () => {
    assert.equal(formatSlackReplyText(""), null);
  });

  it("truncates long replies for Slack", () => {
    const long = "a".repeat(SLACK_MESSAGE_MAX_LEN + 10);
    const formatted = formatSlackReplyText(long);
    assert.ok(formatted);
    if (!formatted) {
      return;
    }
    assert.equal(formatted.length, SLACK_MESSAGE_MAX_LEN + 1);
    assert.ok(formatted.endsWith("…"));
  });
});

describe("convertMarkdownToSlackMrkdwn", () => {
  it("converts markdown bold to Slack mrkdwn", () => {
    assert.equal(
      convertMarkdownToSlackMrkdwn(
        'The **"hr team"** knowledge base has docs.'
      ),
      'The *"hr team"* knowledge base has docs.'
    );
  });

  it("converts markdown links to Slack links", () => {
    assert.equal(
      convertMarkdownToSlackMrkdwn("[Open docs](https://example.com/docs)"),
      "<https://example.com/docs|Open docs>"
    );
  });
});

describe("stripInlineCitationMarkers", () => {
  it("removes inline citation markers including bold variants", () => {
    assert.equal(
      stripInlineCitationMarkers(
        "Deliver AI/ML projects. **[1]**\n\nOwn end-to-end. [1]"
      ),
      "Deliver AI/ML projects.\n\nOwn end-to-end."
    );
  });
});

describe("buildSlackReplyBlocks", () => {
  it("uses intro section, markdown body, references heading, and carousel", () => {
    const blocks = buildSlackReplyBlocks(
      "For the **Founding ML Engineer** role:\n\n## Core experience\n\n- 2+ years in AI/ML [1]",
      {
        1: {
          blurb: "Job description preview",
          content: "Job description text",
          document: 1,
          documentId: "doc-1",
          link: "https://example.com/jd",
          sourceType: "team_source",
          title: "Founding ML Engineer JD",
        },
      }
    );

    assert.equal(blocks[0]?.type, "section");
    assert.equal(blocks[1]?.type, "markdown");
    assert.equal(blocks.at(-2)?.type, "section");
    assert.equal(
      (blocks.at(-2) as { text?: { text?: string } }).text?.text,
      "*References*"
    );
    assert.equal(blocks.at(-1)?.type, "carousel");

    const markdown = (blocks[1] as { text?: string }).text ?? "";
    assert.doesNotMatch(markdown, /\[1\]/);
    assert.match(markdown, /## Core experience/);

    const carousel = blocks.at(-1) as {
      elements?: Array<{ actions?: Array<{ url?: string }> }>;
    };
    assert.equal(
      carousel.elements?.[0]?.actions?.[0]?.url,
      "https://example.com/jd"
    );
  });

  it("avoids splitting the answer into many section blocks", () => {
    const blocks = buildSlackReplyBlocks(
      [
        "Intro paragraph.",
        "## Section A",
        "- Bullet one",
        "- Bullet two",
        "## Section B",
        "- Bullet three",
        "- Bullet four",
      ].join("\n\n")
    );

    const sectionBlocks = blocks.filter((block) => block.type === "section");
    const markdownBlocks = blocks.filter((block) => block.type === "markdown");
    assert.equal(sectionBlocks.length, 1);
    assert.equal(markdownBlocks.length, 1);
  });
});

describe("buildSlackReplyPresentation", () => {
  it("returns fallback text and blocks together", () => {
    const presentation = buildSlackReplyPresentation("**Hello** team");
    assert.ok(presentation);
    if (!presentation) {
      return;
    }
    assert.match(presentation.text, /Hello team/);
    assert.ok(presentation.blocks.length > 0);
  });
});
