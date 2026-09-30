import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatRoomKimiroContextPrompt,
  ROOM_KIMIRO_ROSTER_INLINE_CAP,
} from "@/core/lib/chat/room-kimiro-context";

describe("formatRoomKimiroContextPrompt", () => {
  it("lists members for small rooms and marks the asker", () => {
    const prompt = formatRoomKimiroContextPrompt({
      askerDisplayName: "Prasad",
      askerUserId: "u1",
      chat: { kind: "channel", title: "Support" },
      participants: [
        { displayName: "Prasad", email: "prasad@example.com", userId: "u1" },
        { displayName: "Shubham", email: "shubham@example.com", userId: "u2" },
      ],
    });

    assert.match(prompt, /channel #Support/);
    assert.match(prompt, /Prasad \(asking user\)/);
    assert.match(prompt, /Shubham/);
    assert.match(prompt, /\[Name\]:/);
  });

  it("caps inline roster for large rooms", () => {
    const participants = Array.from(
      { length: ROOM_KIMIRO_ROSTER_INLINE_CAP + 5 },
      (_, index) => ({
        displayName: `Member ${index}`,
        email: `m${index}@example.com`,
        userId: `u${index}`,
      })
    );

    const prompt = formatRoomKimiroContextPrompt({
      askerDisplayName: "Prasad",
      askerUserId: "u0",
      chat: { kind: "group_dm", title: null },
      participants,
    });

    assert.match(prompt, /Members \(30\)/);
    assert.match(prompt, /5 more members/);
  });
});
