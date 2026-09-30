import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  notifyChatRoomMessagesChanged,
  subscribeChatRoom,
} from "./chat-room-bus";

describe("chat-room-bus", () => {
  it("delivers messages.changed to subscribers", () => {
    const chatId = "00000000-0000-4000-8000-000000000001";
    const received: unknown[] = [];
    const unsubscribe = subscribeChatRoom(chatId, (event) => {
      received.push(event);
    });

    notifyChatRoomMessagesChanged({
      chatId,
      threadRootMessageId: "00000000-0000-4000-8000-000000000002",
    });

    unsubscribe();

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], {
      type: "messages.changed",
      chatId,
      threadRootMessageId: "00000000-0000-4000-8000-000000000002",
    });
  });

  it("stops delivering after unsubscribe", () => {
    const chatId = "00000000-0000-4000-8000-000000000003";
    let count = 0;
    const unsubscribe = subscribeChatRoom(chatId, () => {
      count += 1;
    });
    unsubscribe();
    notifyChatRoomMessagesChanged({ chatId });
    assert.equal(count, 0);
  });
});
