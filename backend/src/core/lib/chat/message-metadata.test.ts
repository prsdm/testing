import assert from "node:assert/strict";
import test from "node:test";
import { serializeMessageMetadata } from "./message-metadata";

test("serializeMessageMetadata includes editedAt", () => {
  const serialized = serializeMessageMetadata({
    createdAt: "2026-07-10T06:36:00.000Z",
    editedAt: "2026-07-10T07:06:00.000Z",
  });

  assert.deepEqual(serialized, {
    createdAt: "2026-07-10T06:36:00.000Z",
    editedAt: "2026-07-10T07:06:00.000Z",
  });
});
