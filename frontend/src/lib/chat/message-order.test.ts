import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ChatMessage } from "@/shared/types";
import { sortChatMessagesChronologically } from "./message-order";

function msg(
  id: string,
  role: ChatMessage["role"],
  createdAt?: string,
  replyToMessageId?: string
): ChatMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text: id }],
    metadata:
      createdAt || replyToMessageId
        ? { createdAt, replyToMessageId }
        : undefined,
  };
}

describe("sortChatMessagesChronologically", () => {
  it("orders user before assistant when timestamps are missing", () => {
    const sorted = sortChatMessagesChronologically([
      msg("b-assistant", "assistant", undefined, "a-user"),
      msg("a-user", "user"),
    ]);
    assert.deepEqual(
      sorted.map((m) => m.id),
      ["a-user", "b-assistant"]
    );
  });

  it("orders by createdAt when both present", () => {
    const sorted = sortChatMessagesChronologically([
      msg("late", "assistant", "2026-01-02T00:00:00.000Z"),
      msg("early", "user", "2026-01-01T00:00:00.000Z"),
    ]);
    assert.deepEqual(
      sorted.map((m) => m.id),
      ["early", "late"]
    );
  });

  it("interleaves multiple turns by createdAt", () => {
    const sorted = sortChatMessagesChronologically([
      msg("user-two", "user", "2026-01-01T00:00:04.000Z"),
      msg("asst-one", "assistant", "2026-01-01T00:00:02.000Z"),
      msg("user-one", "user", "2026-01-01T00:00:01.000Z"),
    ]);
    assert.deepEqual(
      sorted.map((m) => m.id),
      ["user-one", "asst-one", "user-two"]
    );
  });

  it("keeps each reply with its trigger even when completion times are late", () => {
    const sorted = sortChatMessagesChronologically([
      msg("user-one", "user", "2026-01-01T00:00:01.000Z"),
      msg("user-two", "user", "2026-01-01T00:00:02.000Z"),
      msg("asst-two", "assistant", "2026-01-01T00:00:05.000Z", "user-two"),
      msg("asst-one", "assistant", "2026-01-01T00:00:04.000Z", "user-one"),
    ]);
    assert.deepEqual(
      sorted.map((m) => m.id),
      ["user-one", "asst-one", "user-two", "asst-two"]
    );
  });

  it("keeps thread root first when timestamps tie", () => {
    const t = "2026-01-01T00:00:00.000Z";
    const sorted = sortChatMessagesChronologically(
      [msg("reply", "assistant", t), msg("root", "user", t)],
      { threadRootMessageId: "root" }
    );
    assert.deepEqual(
      sorted.map((m) => m.id),
      ["root", "reply"]
    );
  });
});
