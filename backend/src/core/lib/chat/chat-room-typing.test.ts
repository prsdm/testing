import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { subscribeChatRoom } from "./chat-room-bus";
import { clearChatRoomTyping, setChatRoomTyping } from "./chat-room-typing";

describe("chat-room-typing", () => {
  it("publishes typing.changed when typists update", () => {
    const chatId = "00000000-0000-4000-8000-000000000010";
    const received: unknown[] = [];
    const unsubscribe = subscribeChatRoom(chatId, (event) => {
      received.push(event);
    });

    setChatRoomTyping({
      chatId,
      displayName: "Alex",
      threadRootMessageId: null,
      userId: "user-a",
    });

    clearChatRoomTyping({ chatId, userId: "user-a" });
    unsubscribe();

    assert.equal(received.length, 2);
    assert.equal((received[0] as { type: string }).type, "typing.changed");
    assert.deepEqual((received[0] as { typists: unknown[] }).typists, [
      {
        displayName: "Alex",
        threadRootMessageId: null,
        userId: "user-a",
      },
    ]);
    assert.deepEqual((received[1] as { typists: unknown[] }).typists, []);
  });
});
