import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatMessage } from "@/shared/types";
import {
  buildThreadSummaries,
  mergeMessagesForThreadSummaries,
} from "./thread-summary";

describe("mergeMessagesForThreadSummaries", () => {
  it("prefers live messages over thread-only API rows", () => {
    const rootId = "root-1";
    const merged = mergeMessagesForThreadSummaries(
      [
        {
          id: "reply-live",
          metadata: { createdAt: "2026-01-01T12:00:00.000Z" },
          parts: [{ type: "text", text: "live" }],
          role: "user",
          threadRootMessageId: rootId,
        },
      ],
      [
        {
          id: "reply-live",
          metadata: { createdAt: "2026-01-01T11:00:00.000Z" },
          parts: [{ type: "text", text: "stale" }],
          role: "user",
          threadRootMessageId: rootId,
        },
        {
          id: "reply-api",
          metadata: { createdAt: "2026-01-01T10:00:00.000Z" },
          parts: [{ type: "text", text: "api" }],
          role: "assistant",
          threadRootMessageId: rootId,
        },
      ]
    );
    assert.equal(merged.length, 2);
    const live = merged.find((message) => message.id === "reply-live");
    assert.equal(
      live?.parts[0]?.type === "text" ? live.parts[0].text : "",
      "live"
    );
  });
});

describe("buildThreadSummaries", () => {
  it("aggregates reply count, last reply time, and participants", () => {
    const rootId = "root-1";
    const messages: ChatMessage[] = [
      {
        id: rootId,
        parts: [{ type: "text", text: "root" }],
        role: "user",
        threadRootMessageId: null,
      },
      {
        id: "reply-1",
        metadata: {
          authorAuthUserId: "u1",
          authorDisplayName: "Ada",
          createdAt: "2026-01-01T10:00:00.000Z",
        },
        parts: [{ type: "text", text: "hi" }],
        role: "user",
        threadRootMessageId: rootId,
      },
      {
        id: "reply-2",
        metadata: {
          agentSlug: "kimiro",
          createdAt: "2026-01-01T11:00:00.000Z",
        },
        parts: [{ type: "text", text: "hello" }],
        role: "assistant",
        threadRootMessageId: rootId,
      },
    ];

    const summary = buildThreadSummaries(messages, { [rootId]: 2 })[rootId];
    assert.equal(summary.replyCount, 2);
    assert.equal(summary.lastReplyAt, "2026-01-01T11:00:00.000Z");
    assert.equal(summary.participants.length, 2);
    assert.equal(summary.participants[0]?.kind, "kimiro");
    assert.equal(
      summary.participants[1]?.kind === "user"
        ? summary.participants[1].name
        : null,
      "Ada"
    );
  });
});
