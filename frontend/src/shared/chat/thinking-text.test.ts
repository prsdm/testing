import assert from "node:assert/strict";
import test from "node:test";
import {
  collapseTokenizedReasoningLines,
  normalizeThinkingText,
  reasoningComparisonKey,
} from "./thinking-text";

test("collapses token-per-line reasoning streams into prose", () => {
  assert.equal(
    collapseTokenizedReasoningLines(
      "a\nreport\ntitle\nand\nrelevant\nterms.\nThere"
    ),
    "a report title and relevant terms. There"
  );
});

test("preserves real paragraph breaks in thinking text", () => {
  const input =
    "First paragraph with multiple words.\n\nSecond paragraph here.";
  assert.equal(normalizeThinkingText(input), input);
});

test("breaks after bold thinking title before body text", () => {
  const input =
    "**Planning a search project** I see that I need to plan a search project.";
  assert.equal(
    normalizeThinkingText(input),
    "**Planning a search project**\n\nI see that I need to plan a search project."
  );
});

test("reasoning comparison ignores streamed punctuation spacing", () => {
  assert.equal(
    reasoningComparisonKey(
      'Create a file, then use "sample.txt" with simple content.'
    ),
    reasoningComparisonKey(
      'Create a file , then use " sample.txt " with simple content .'
    )
  );
});

test("repairs finalized reasoning token-spacing artifacts", () => {
  assert.equal(
    normalizeThinkingText(
      'Create an m vp .doc file with " M VP " as content .Then upload it .'
    ),
    'Create an mvp.doc file with "MVP" as content.Then upload it.'
  );
});
