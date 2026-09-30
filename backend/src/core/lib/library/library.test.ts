import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  coerceSaveToLibraryInput,
  normalizeSaveToLibraryInput,
} from "@/core/lib/ai/tools/save-to-library";
import { readSandboxSessionFile } from "@/core/lib/sandbox/read-session-file";
import {
  isLibraryPathname,
  LIBRARY_ALLOWED_CONTENT_TYPES,
  libraryPathname,
  sanitizeLibraryFileName,
} from "@/shared/library/constants";
import { PPTX_LIBRARY_MIME } from "@/shared/library/content-type";

describe("library constants", () => {
  it("builds user-scoped library pathnames", () => {
    const pathname = libraryPathname({
      fileId: "file-1",
      safeName: "report.csv",
      tenantId: "tenant-1",
      userId: "user-1",
    });
    assert.equal(pathname, "library/tenant-1/user-1/file-1/report.csv");
    assert.equal(isLibraryPathname(pathname), true);
  });

  it("sanitizes unsafe filenames", () => {
    assert.equal(
      sanitizeLibraryFileName("  my report?.csv  "),
      "my_report_.csv"
    );
  });

  it("allows pptx in library content types", () => {
    assert.ok(
      (LIBRARY_ALLOWED_CONTENT_TYPES as readonly string[]).includes(
        PPTX_LIBRARY_MIME
      )
    );
  });
});

describe("normalizeSaveToLibraryInput", () => {
  it("accepts markdown content", () => {
    const result = normalizeSaveToLibraryInput({
      content: "# Hello",
      filename: "summary.md",
    });
    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.contentType, "text/markdown");
      assert.equal(result.source.kind, "text");
    }
  });

  it("accepts sandbox outputs path for pptx", () => {
    const result = normalizeSaveToLibraryInput({
      filename: "deck.pptx",
      sandboxPath: "outputs/deck.pptx",
    });
    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.contentType, PPTX_LIBRARY_MIME);
      assert.equal(result.source.kind, "sandbox");
      assert.equal(result.source.sandboxPath, "outputs/deck.pptx");
    }
  });

  it("rejects pptx mime with inline text content", () => {
    const result = normalizeSaveToLibraryInput({
      content: "not a real pptx",
      contentType: PPTX_LIBRARY_MIME,
      filename: "deck.pptx",
    });
    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.source.kind, "text");
    }
  });

  it("accepts sandbox path when content is an empty string", () => {
    const coerced = coerceSaveToLibraryInput({
      content: "",
      filename: "deck.pptx",
      sandboxPath: "outputs/deck.pptx",
    });
    const result = normalizeSaveToLibraryInput(coerced);
    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.source.kind, "sandbox");
      assert.equal(result.source.sandboxPath, "outputs/deck.pptx");
    }
  });

  it("rejects paths outside outputs", () => {
    const result = normalizeSaveToLibraryInput({
      filename: "deck.pptx",
      sandboxPath: "staging/deck.pptx",
    });
    assert.equal("error" in result, true);
  });

  it("prefers sandboxPath when both content and sandboxPath are sent", () => {
    const result = normalizeSaveToLibraryInput({
      content: "ignored when path is set",
      filename: "deck.pptx",
      sandboxPath: "outputs/deck.pptx",
    });
    assert.equal("error" in result, false);
    if (!("error" in result)) {
      assert.equal(result.source.kind, "sandbox");
    }
  });

  it("rejects oversized content", () => {
    const result = normalizeSaveToLibraryInput({
      content: "x".repeat(16 * 1024 * 1024),
      filename: "big.txt",
    });
    assert.equal("error" in result, true);
  });
});

describe("readSandboxSessionFile", () => {
  const tempRoots: string[] = [];
  const previousRoot = process.env.SANDBOX_LOCAL_SESSIONS_ROOT;

  after(async () => {
    process.env.SANDBOX_LOCAL_SESSIONS_ROOT = previousRoot;
    await Promise.all(
      tempRoots.map((root) => fs.rm(root, { force: true, recursive: true }))
    );
  });

  it("reads a file from outputs/", async () => {
    const sessionsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "kimiro-read-session-")
    );
    tempRoots.push(sessionsRoot);
    process.env.SANDBOX_LOCAL_SESSIONS_ROOT = sessionsRoot;
    process.env.SANDBOX_SKIP_GCS_SYNC = "true";

    const sessionRoot = path.join(
      sessionsRoot,
      "tenant-1",
      "user-1",
      "sessions",
      "chat-1"
    );
    const filePath = path.join(sessionRoot, "outputs", "deck.pptx");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, Buffer.from("fake-pptx-bytes"));

    const read = await readSandboxSessionFile({
      chatId: "chat-1",
      sandboxPath: "outputs/deck.pptx",
      tenantId: "tenant-1",
      userId: "user-1",
    });

    assert.equal("error" in read, false);
    if (!("error" in read)) {
      assert.equal(read.body.toString("utf8"), "fake-pptx-bytes");
      assert.equal(read.sizeBytes, 15);
    }
  });
});
