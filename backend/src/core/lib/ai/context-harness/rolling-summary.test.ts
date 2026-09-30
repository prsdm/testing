import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UIMessage } from "ai";
import {
  activeUiMessagesAfterSummary,
  chatContextSummaryFromRow,
  isPersistedSummaryValid,
  splitUiMessagesForCompaction,
} from "./rolling-summary";

describe("rolling summary helpers", () => {
  it("parses persisted summary from chat row", () => {
    const parsed = chatContextSummaryFromRow({
      contextSummary: "Earlier facts",
      contextSummaryThroughMessageId: "msg-1",
      contextSummaryUpdatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    assert.deepEqual(parsed, {
      summary: "Earlier facts",
      throughMessageId: "msg-1",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns active messages after summary bookmark", () => {
    const uiMessages = [
      { id: "m1", parts: [], role: "user" },
      { id: "m2", parts: [], role: "assistant" },
      { id: "m3", parts: [], role: "user" },
    ] as UIMessage[];

    const active = activeUiMessagesAfterSummary({
      persistedSummary: {
        summary: "s",
        throughMessageId: "m1",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      uiMessages,
    });

    assert.deepEqual(
      active.map((message) => message.id),
      ["m2", "m3"]
    );
  });

  it("invalidates summary when bookmark message is missing", () => {
    const uiMessages = [{ id: "m1", parts: [], role: "user" }] as UIMessage[];
    assert.equal(
      isPersistedSummaryValid({
        persistedSummary: {
          summary: "s",
          throughMessageId: "missing",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        uiMessages,
      }),
      false
    );
  });

  it("splits ui messages for compaction", () => {
    const uiMessages = Array.from({ length: 5 }, (_, index) => ({
      id: `m${index}`,
      parts: [],
      role: "user",
    })) as UIMessage[];
    const { older, recent } = splitUiMessagesForCompaction(uiMessages, 2);
    assert.deepEqual(
      older.map((message) => message.id),
      ["m0", "m1", "m2"]
    );
    assert.deepEqual(
      recent.map((message) => message.id),
      ["m3", "m4"]
    );
  });
});
