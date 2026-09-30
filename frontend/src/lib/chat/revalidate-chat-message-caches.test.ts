import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatMessage } from "@/shared/types";
import { revalidateChatMessageCaches } from "./revalidate-chat-message-caches";

describe("revalidateChatMessageCaches", () => {
  it("revalidates main timeline and thread keys from messages and extras", async () => {
    const mutated: string[] = [];
    const messages: ChatMessage[] = [
      {
        id: "root",
        parts: [{ text: "root", type: "text" }],
        role: "user",
        threadRootMessageId: null,
      },
      {
        id: "reply",
        parts: [{ text: "reply", type: "text" }],
        role: "user",
        threadRootMessageId: "root",
      },
    ];

    await revalidateChatMessageCaches(
      (key) => {
        mutated.push(key);
        return Promise.resolve();
      },
      "chat-1",
      messages,
      ["open-thread-root"]
    );

    assert.deepEqual(mutated, [
      "/api/messages?chatId=chat-1",
      "/api/messages?chatId=chat-1&threadRootMessageId=root",
      "/api/messages?chatId=chat-1&threadRootMessageId=open-thread-root",
    ]);
  });
});
