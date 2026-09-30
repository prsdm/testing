import assert from "node:assert/strict";
import test from "node:test";
import {
  roomLiveAssistantPartsAreVisible,
  sanitizeAssistantPartsForPersistence,
  sanitizeAssistantPartsForRoomLiveSync,
} from "./sanitize-assistant-parts-for-persistence";

test("sanitizeAssistantPartsForPersistence drops in-flight tool calls", () => {
  const parts = sanitizeAssistantPartsForPersistence([
    {
      state: "streaming",
      text: "Planning the upload.",
      type: "reasoning",
    },
    {
      input: { query: "earnings flash report" },
      state: "input-streaming",
      toolCallId: "search-1",
      type: "tool-sourceSearch",
    },
    {
      input: { query: "Finance" },
      state: "input-available",
      toolCallId: "search-2",
      type: "tool-driveSearchFiles",
    },
    {
      input: { todos: [] },
      output: { todos: [] },
      state: "output-available",
      toolCallId: "todo-1",
      type: "tool-todoWrite",
    },
  ]);

  assert.equal(
    parts.some((part) => part.type === "tool-sourceSearch"),
    false
  );
  assert.equal(
    parts.some((part) => part.type === "tool-driveSearchFiles"),
    false
  );
  assert.equal(
    parts.some((part) => part.type === "tool-todoWrite"),
    true
  );
  assert.equal(
    parts.some(
      (part) =>
        part.type === "reasoning" && part.text === "Planning the upload."
    ),
    true
  );
});

test("sanitizeAssistantPartsForRoomLiveSync keeps input-available tools", () => {
  const parts = sanitizeAssistantPartsForRoomLiveSync([
    {
      input: { query: "openai news" },
      state: "input-available",
      toolCallId: "search-1",
      type: "tool-sourceSearch",
    },
  ]);

  assert.equal(parts.length, 1);
  assert.equal(roomLiveAssistantPartsAreVisible(parts), true);
});
