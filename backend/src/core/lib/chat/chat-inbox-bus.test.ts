import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notifyUserChatInbox, subscribeUserChatInbox } from "./chat-inbox-bus";

describe("chat-inbox-bus", () => {
  it("delivers unread.changed to subscribers", () => {
    const events: Array<{ chatId: string }> = [];
    const unsubscribe = subscribeUserChatInbox("user-1", (event) => {
      events.push(event);
    });

    notifyUserChatInbox("user-1", {
      chatId: "chat-a",
      type: "unread.changed",
    });
    notifyUserChatInbox("user-2", {
      chatId: "chat-b",
      type: "unread.changed",
    });

    unsubscribe();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.chatId, "chat-a");
  });
});
