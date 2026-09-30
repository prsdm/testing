import assert from "node:assert/strict";
import test from "node:test";
import { applyStreamingAssistantSnapshot } from "@/shared/chat/merge-workflow-chat-messages";
import {
  encodeExecutedToolPartSync,
  extractExecutedToolPartUpdates,
} from "./executed-tool-part-sync";

test("extractExecutedToolPartUpdates returns approved tools that finished execution", () => {
  const updates = extractExecutedToolPartUpdates({
    nextParts: [
      {
        input: { name: "Finance" },
        output: { id: "folder-123", name: "Finance" },
        state: "output-available",
        toolCallId: "folder-1",
        type: "tool-driveCreateFolder",
      },
    ],
    previousParts: [
      {
        approval: { approved: true, id: "approval-1" },
        input: { name: "Finance" },
        state: "approval-responded",
        toolCallId: "folder-1",
        type: "tool-driveCreateFolder",
      },
    ],
  });

  assert.equal(updates.length, 1);
  assert.equal(
    updates[0] && "state" in updates[0] ? updates[0].state : undefined,
    "output-available"
  );
});

test("applyStreamingAssistantSnapshot prefers executed output over approval-responded", () => {
  const merged = applyStreamingAssistantSnapshot(
    [
      {
        approval: { approved: true, id: "approval-1" },
        input: { name: "Finance" },
        state: "approval-responded",
        toolCallId: "folder-1",
        type: "tool-driveCreateFolder",
      },
    ],
    [
      {
        approval: { approved: true, id: "approval-1" },
        input: { name: "Finance" },
        state: "approval-responded",
        toolCallId: "folder-1",
        type: "tool-driveCreateFolder",
      },
    ]
  );

  const synced = applyStreamingAssistantSnapshot(merged, [
    {
      input: { name: "Finance" },
      output: { id: "folder-123", name: "Finance" },
      state: "output-available",
      toolCallId: "folder-1",
      type: "tool-driveCreateFolder",
    },
  ]);

  assert.equal(
    synced[0] && "state" in synced[0] ? synced[0].state : undefined,
    "output-available"
  );
  const firstSyncedPart = synced[0];
  assert.deepEqual(
    firstSyncedPart && "output" in firstSyncedPart
      ? firstSyncedPart.output
      : undefined,
    {
      id: "folder-123",
      name: "Finance",
    }
  );
});

test("encodeExecutedToolPartSync round-trips through base64url", () => {
  const encoded = encodeExecutedToolPartSync([
    {
      output: { id: "folder-123" },
      state: "output-available",
      toolCallId: "folder-1",
      type: "tool-driveCreateFolder",
    },
  ]);

  const decoded = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  );
  assert.equal(decoded[0]?.toolCallId, "folder-1");
});
