import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatMessage } from "@/shared/types";
import { mergeRoomThreadMessages } from "./room-thread-message-merge";

function msg(
  id: string,
  role: ChatMessage["role"],
  createdAt: string,
  threadRootMessageId: string | null = "root"
): ChatMessage {
  return {
    id,
    metadata: { createdAt },
    parts: [{ text: id, type: "text" }],
    role,
    threadRootMessageId,
  };
}

describe("mergeRoomThreadMessages", () => {
  it("keeps server timestamps when live registry overwrites order", () => {
    const merged = mergeRoomThreadMessages({
      liveMessages: [
        msg("user-2", "user", "2099-01-01T00:00:00.000Z"),
        msg("asst-1", "assistant", "2099-01-01T00:00:00.000Z"),
        msg("user-1", "user", "2099-01-01T00:00:00.000Z", null),
      ],
      serverMessages: [
        msg("user-1", "user", "2026-01-01T00:00:01.000Z", null),
        msg("asst-1", "assistant", "2026-01-01T00:00:02.000Z"),
        msg("user-2", "user", "2026-01-01T00:00:03.000Z"),
      ],
      threadRootMessageId: "root",
    });

    assert.deepEqual(
      merged.map((message) => message.id),
      ["user-1", "asst-1", "user-2"]
    );
  });
});
