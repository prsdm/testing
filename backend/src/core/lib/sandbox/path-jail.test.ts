import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSessionDirectoryPath,
  resolveSessionPath,
  SandboxPathError,
} from "@/core/lib/sandbox/path-jail";

describe("sandbox path-jail", () => {
  it("resolves allowed session paths", () => {
    const resolved = resolveSessionPath({
      relativePath: "uploads/data.csv",
      sessionRoot: "/workspace/sessions/t/u/sessions/chat-1",
    });
    assert.equal(
      resolved.absolutePath,
      "/workspace/sessions/t/u/sessions/chat-1/uploads/data.csv"
    );
    assert.equal(resolved.relativePath, "uploads/data.csv");
  });

  it("rejects path traversal", () => {
    assert.throws(
      () =>
        resolveSessionPath({
          relativePath: "uploads/../etc/passwd",
          sessionRoot: "/workspace/sessions/t/u/sessions/chat-1",
        }),
      SandboxPathError
    );
  });

  it("rejects paths outside allowed subdirs", () => {
    assert.throws(
      () =>
        resolveSessionPath({
          relativePath: "secrets/key.txt",
          sessionRoot: "/workspace/sessions/t/u/sessions/chat-1",
        }),
      SandboxPathError
    );
  });

  it("builds session directory from tenant, user, and chat id", () => {
    assert.equal(
      getSessionDirectoryPath({
        chatId: "abc-123",
        sessionsRoot: "/workspace/sessions",
        tenantId: "tenant-1",
        userId: "user-1",
      }),
      "/workspace/sessions/tenant-1/user-1/sessions/abc-123"
    );
  });
});
