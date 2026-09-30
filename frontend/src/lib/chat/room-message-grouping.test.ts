import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ROOM_MESSAGE_GROUP_GAP_MS,
  shouldContinueRoomMessageGroup,
} from "@/lib/chat/room-message-grouping";
import type { ChatMessage } from "@/shared/types";

describe("room message grouping", () => {
  it("groups same peer within five minutes", () => {
    const t0 = "2026-09-24T17:06:00.000Z";
    const t1 = new Date(
      new Date(t0).getTime() + ROOM_MESSAGE_GROUP_GAP_MS - 1000
    ).toISOString();
    const previous: ChatMessage = {
      id: "1",
      metadata: {
        authorAuthUserId: "peer-1",
        createdAt: t0,
      },
      parts: [{ text: "a", type: "text" }],
      role: "user",
    };
    const current: ChatMessage = {
      id: "2",
      metadata: {
        authorAuthUserId: "peer-1",
        createdAt: t1,
      },
      parts: [{ text: "b", type: "text" }],
      role: "user",
    };
    assert.equal(
      shouldContinueRoomMessageGroup(previous, current, "viewer"),
      true
    );
  });

  it("breaks group after a message that has thread replies", () => {
    const createdAt = "2026-09-24T17:06:00.000Z";
    const previous: ChatMessage = {
      id: "1",
      metadata: { authorAuthUserId: "peer-1", createdAt },
      parts: [{ text: "first", type: "text" }],
      role: "user",
    };
    const current: ChatMessage = {
      id: "2",
      metadata: { authorAuthUserId: "peer-1", createdAt },
      parts: [{ text: "second", type: "text" }],
      role: "user",
    };
    assert.equal(
      shouldContinueRoomMessageGroup(previous, current, "viewer", {
        previousThreadReplyCount: 1,
      }),
      false
    );
  });

  it("breaks group when author changes", () => {
    const createdAt = "2026-09-24T17:06:00.000Z";
    const previous: ChatMessage = {
      id: "1",
      metadata: { authorAuthUserId: "a", createdAt },
      parts: [{ text: "a", type: "text" }],
      role: "user",
    };
    const current: ChatMessage = {
      id: "2",
      metadata: { authorAuthUserId: "b", createdAt },
      parts: [{ text: "b", type: "text" }],
      role: "user",
    };
    assert.equal(
      shouldContinueRoomMessageGroup(previous, current, "viewer"),
      false
    );
  });
});
