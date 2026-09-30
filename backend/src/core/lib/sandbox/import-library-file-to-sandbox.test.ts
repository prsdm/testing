import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  importLibraryToSandboxSuccessContextForLlm,
  normalizeImportLibraryToSandboxInput,
} from "@/core/lib/ai/tools/import-library-to-sandbox";
import { importLibraryFileToSandbox } from "@/core/lib/sandbox/import-library-file-to-sandbox";

describe("importLibraryToSandbox tool", () => {
  it("requires a library file id", () => {
    const result = normalizeImportLibraryToSandboxInput({});
    assert.equal("error" in result, true);
  });

  it("accepts optional outputs path", () => {
    const result = normalizeImportLibraryToSandboxInput({
      libraryFileId: "550e8400-e29b-41d4-a716-446655440000",
      sandboxPath: "outputs/edited.xlsx",
    });
    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.sandboxPath, "outputs/edited.xlsx");
    }
  });

  it("formats model context with sandbox path", () => {
    const text = importLibraryToSandboxSuccessContextForLlm({
      libraryFileId: "550e8400-e29b-41d4-a716-446655440000",
      reusedExisting: true,
      sandboxPath: "outputs/budget.xlsx",
    });
    assert.match(text, /outputs\/budget\.xlsx/);
    assert.match(text, /550e8400-e29b-41d4-a716-446655440000/);
    assert.match(text, /Reused the existing sandbox copy/);
  });
});

describe("importLibraryFileToSandbox", () => {
  const tempRoots: string[] = [];
  const previousRoot = process.env.SANDBOX_LOCAL_SESSIONS_ROOT;

  after(async () => {
    process.env.SANDBOX_LOCAL_SESSIONS_ROOT = previousRoot;
    await Promise.all(
      tempRoots.map((root) => fs.rm(root, { force: true, recursive: true }))
    );
  });

  it("writes library bytes to outputs and reuses unchanged copies", async () => {
    const sessionsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "kimiro-import-library-")
    );
    tempRoots.push(sessionsRoot);
    process.env.SANDBOX_LOCAL_SESSIONS_ROOT = sessionsRoot;
    process.env.SANDBOX_SKIP_GCS_SYNC = "true";

    const body = Buffer.from("sheet-bytes");
    const first = await importLibraryFileToSandbox({
      body,
      chatId: "chat-1",
      libraryFileId: "file-1",
      name: "budget.xlsx",
      sizeBytes: body.byteLength,
      tenantId: "tenant-1",
      userId: "user-1",
    });
    assert.equal("error" in first, false);
    if ("error" in first) {
      return;
    }
    assert.equal(first.sandboxPath, "outputs/budget.xlsx");
    assert.equal(first.reusedExisting, false);

    const second = await importLibraryFileToSandbox({
      body,
      chatId: "chat-1",
      libraryFileId: "file-1",
      name: "budget.xlsx",
      sizeBytes: body.byteLength,
      tenantId: "tenant-1",
      userId: "user-1",
    });
    assert.equal("error" in second, false);
    if ("error" in second) {
      return;
    }
    assert.equal(second.reusedExisting, true);
  });
});
