import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCX_DRIVE_MIME,
  XLSX_DRIVE_MIME,
} from "@/shared/artifacts/prepare-drive-export";
import { XLSX_CONTENT_PREFIX } from "@/shared/artifacts/sheet-xlsx";
import { DOCX_CONTENT_PREFIX } from "@/shared/artifacts/text-docx";
import { PPTX_LIBRARY_MIME } from "@/shared/library/content-type";
import {
  chatAttachableMimeFromFileName,
  ensureChatAttachFileName,
  GOOGLE_DOC_MIME,
  GOOGLE_SHEET_MIME,
  isChatAttachableMime,
  isDriveChatAttachableMime,
  isDriveImportableMime,
  resolveChatAttachPlan,
  resolveDriveImportPlan,
  wrapDriveBytesAsArtifactContent,
} from "./drive-import";

describe("resolveDriveImportPlan", () => {
  it("maps Google Docs and native docx to text artifacts", () => {
    assert.deepEqual(resolveDriveImportPlan(GOOGLE_DOC_MIME), {
      exportMimeType: DOCX_DRIVE_MIME,
      kind: "text",
      storagePrefix: DOCX_CONTENT_PREFIX,
    });
    assert.deepEqual(resolveDriveImportPlan(DOCX_DRIVE_MIME), {
      exportMimeType: null,
      kind: "text",
      storagePrefix: DOCX_CONTENT_PREFIX,
    });
  });

  it("maps Google Sheets and native xlsx to sheet artifacts", () => {
    assert.deepEqual(resolveDriveImportPlan(GOOGLE_SHEET_MIME), {
      exportMimeType: XLSX_DRIVE_MIME,
      kind: "sheet",
      storagePrefix: XLSX_CONTENT_PREFIX,
    });
    assert.deepEqual(resolveDriveImportPlan(XLSX_DRIVE_MIME), {
      exportMimeType: null,
      kind: "sheet",
      storagePrefix: XLSX_CONTENT_PREFIX,
    });
  });

  it("rejects unsupported types", () => {
    assert.equal(resolveDriveImportPlan("application/pdf"), null);
    assert.equal(isDriveImportableMime("application/pdf"), false);
    assert.equal(isDriveImportableMime(GOOGLE_DOC_MIME), true);
  });
});

describe("resolveChatAttachPlan", () => {
  it("allows images, pdf, text, docs, sheets, and Google Docs/Sheets", () => {
    assert.deepEqual(resolveChatAttachPlan("image/jpeg"), {
      download: "media",
      resultMimeType: "image/jpeg",
    });
    assert.deepEqual(resolveChatAttachPlan("application/pdf"), {
      download: "media",
      resultMimeType: "application/pdf",
    });
    assert.deepEqual(resolveChatAttachPlan(DOCX_DRIVE_MIME), {
      download: "media",
      resultMimeType: DOCX_DRIVE_MIME,
    });
    assert.deepEqual(resolveChatAttachPlan(XLSX_DRIVE_MIME), {
      download: "media",
      resultMimeType: XLSX_DRIVE_MIME,
    });
    assert.deepEqual(resolveChatAttachPlan(GOOGLE_DOC_MIME), {
      download: "export",
      exportMimeType: "application/pdf",
      resultExtension: ".pdf",
      resultMimeType: "application/pdf",
    });
    assert.deepEqual(resolveChatAttachPlan(GOOGLE_SHEET_MIME), {
      download: "export",
      exportMimeType: XLSX_DRIVE_MIME,
      resultExtension: ".xlsx",
      resultMimeType: XLSX_DRIVE_MIME,
    });
    assert.equal(isDriveChatAttachableMime(GOOGLE_DOC_MIME), true);
    assert.equal(isDriveChatAttachableMime(GOOGLE_SHEET_MIME), true);
    assert.equal(isChatAttachableMime("application/pdf"), true);
    assert.equal(isChatAttachableMime(XLSX_DRIVE_MIME), true);
  });

  it("infers mime from file names and ensures export extensions", () => {
    assert.equal(
      chatAttachableMimeFromFileName("brief.PDF"),
      "application/pdf"
    );
    assert.equal(chatAttachableMimeFromFileName("notes.docx"), DOCX_DRIVE_MIME);
    assert.equal(chatAttachableMimeFromFileName("sheet.xlsx"), XLSX_DRIVE_MIME);
    assert.equal(
      chatAttachableMimeFromFileName("deck.pptx"),
      PPTX_LIBRARY_MIME
    );
    assert.equal(
      ensureChatAttachFileName("Quarterly plan", {
        download: "export",
        exportMimeType: "application/pdf",
        resultExtension: ".pdf",
        resultMimeType: "application/pdf",
      }),
      "Quarterly plan.pdf"
    );
    assert.equal(
      ensureChatAttachFileName("already.pdf", {
        download: "export",
        exportMimeType: "application/pdf",
        resultExtension: ".pdf",
        resultMimeType: "application/pdf",
      }),
      "already.pdf"
    );
  });
});

describe("wrapDriveBytesAsArtifactContent", () => {
  it("prefixes base64 bytes for storage", () => {
    const plan = resolveDriveImportPlan(DOCX_DRIVE_MIME);
    assert.ok(plan);
    const content = wrapDriveBytesAsArtifactContent(plan, Buffer.from("hello"));
    assert.equal(content.startsWith(DOCX_CONTENT_PREFIX), true);
    assert.equal(
      content.slice(DOCX_CONTENT_PREFIX.length),
      Buffer.from("hello").toString("base64")
    );
  });
});
