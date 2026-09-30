import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessage } from "@/shared/types";
import {
  getMessagePreviewLines,
  resolveChannelInboxListDisplay,
} from "./message-preview-text";

test("getMessagePreviewLines splits first line as subject", () => {
  const message = {
    id: "1",
    role: "user",
    parts: [{ type: "text", text: "Ship timeline\nWe need a date by Friday." }],
  } as ChatMessage;

  const preview = getMessagePreviewLines(message);
  assert.equal(preview.subject, "Ship timeline");
  assert.match(preview.snippet, /Friday/);
});

test("resolveChannelInboxListDisplay prefers thread title metadata", () => {
  const message = {
    id: "1",
    role: "user",
    metadata: { threadTitle: "Launch plan" },
    parts: [{ type: "text", text: "Body line for preview" }],
  } as ChatMessage;

  const display = resolveChannelInboxListDisplay(message, []);
  assert.equal(display.title, "Launch plan");
  assert.match(display.preview, /Body line/);
});

test("resolveChannelInboxListDisplay uses last reply when root is title-only", () => {
  const message = {
    id: "1",
    role: "user",
    metadata: { threadTitle: "Launch plan" },
    parts: [{ type: "text", text: "\u200b" }],
  } as ChatMessage;

  const display = resolveChannelInboxListDisplay(message, [], {
    lastReplyPreview: "@kimiro hello there",
  });
  assert.equal(display.title, "Launch plan");
  assert.equal(display.preview, "@kimiro hello there");
});
