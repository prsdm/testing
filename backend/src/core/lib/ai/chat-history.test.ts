import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildChatHistory } from "@/core/lib/ai/chat-history";
import type { ChatMessage } from "@/shared/types";

describe("buildChatHistory", () => {
  it("labels room speakers when requested", () => {
    const messages: ChatMessage[] = [
      {
        id: "u1",
        metadata: { authorDisplayName: "Shubham" },
        parts: [{ text: "hello team", type: "text" }],
        role: "user",
      },
      {
        id: "a1",
        parts: [{ text: "Hi everyone", type: "text" }],
        role: "assistant",
      },
    ];

    const history = buildChatHistory(messages, { labelRoomSpeakers: true });

    assert.deepEqual(history, [
      { content: "[Shubham]: hello team", role: "user" },
      { content: "[Kimiro]: Hi everyone", role: "assistant" },
    ]);
  });
});
