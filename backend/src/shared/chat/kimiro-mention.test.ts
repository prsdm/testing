import assert from "node:assert/strict";
import { test } from "node:test";
import {
  messageInvokesKimiro,
  stripKimiroMention,
} from "@/shared/chat/kimiro-mention";

test("messageInvokesKimiro matches @Kimiro case-insensitively", () => {
  assert.equal(messageInvokesKimiro("hey @Kimiro what's up"), true);
  assert.equal(messageInvokesKimiro("hey @kimiro"), true);
  assert.equal(messageInvokesKimiro("hello team"), false);
});

test("stripKimiroMention removes mention and trims", () => {
  assert.equal(
    stripKimiroMention("  @Kimiro  summarize this  "),
    "summarize this"
  );
});
