import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterRoomTypistsForScope,
  formatRoomTypingLabel,
} from "./room-typing";

describe("room-typing", () => {
  it("filters by thread scope and current user", () => {
    const filtered = filterRoomTypistsForScope({
      currentUserId: "me",
      threadRootMessageId: null,
      typists: [
        {
          displayName: "Alex Kim",
          threadRootMessageId: null,
          userId: "alex",
        },
        {
          displayName: "Me",
          threadRootMessageId: null,
          userId: "me",
        },
        {
          displayName: "Bob",
          threadRootMessageId: "thread-1",
          userId: "bob",
        },
      ],
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.userId, "alex");
  });

  it("formats single and multiple typists", () => {
    assert.equal(
      formatRoomTypingLabel([
        {
          displayName: "Alex Kim",
          threadRootMessageId: null,
          userId: "a",
        },
      ]),
      "Alex is typing…"
    );
    assert.equal(
      formatRoomTypingLabel([
        {
          displayName: "Alex",
          threadRootMessageId: null,
          userId: "a",
        },
        {
          displayName: "Bob",
          threadRootMessageId: null,
          userId: "b",
        },
      ]),
      "Alex and Bob are typing…"
    );
  });
});
