import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DOCX_DRIVE_MIME,
  prepareArtifactDriveExport,
  XLSX_DRIVE_MIME,
} from "./prepare-drive-export";
import { encodeAoAAsXlsxContent, XLSX_CONTENT_PREFIX } from "./sheet-xlsx";
import { DOCX_CONTENT_PREFIX, encodeMarkdownAsDocxContent } from "./text-docx";

describe("prepareArtifactDriveExport", () => {
  it("exports stored xlsx bytes for sheets", async () => {
    const stored = encodeAoAAsXlsxContent([["A"], ["1"]], "Budget");
    const prepared = await prepareArtifactDriveExport({
      content: stored,
      kind: "sheet",
      title: "Budget",
    });
    assert.equal(prepared.name, "Budget.xlsx");
    assert.equal(prepared.mimeType, XLSX_DRIVE_MIME);
    assert.equal(
      prepared.contentBase64,
      stored.slice(XLSX_CONTENT_PREFIX.length)
    );
  });

  it("exports stored docx bytes for text", async () => {
    const stored = await encodeMarkdownAsDocxContent("# Hello");
    const prepared = await prepareArtifactDriveExport({
      content: stored,
      kind: "text",
      title: "Notes",
    });
    assert.equal(prepared.name, "Notes.docx");
    assert.equal(prepared.mimeType, DOCX_DRIVE_MIME);
    assert.equal(
      prepared.contentBase64,
      stored.slice(DOCX_CONTENT_PREFIX.length)
    );
  });

  it("exports code as utf-8 base64 text", async () => {
    const prepared = await prepareArtifactDriveExport({
      content: "print(1)",
      kind: "code",
      title: "script.py",
    });
    assert.equal(prepared.name, "script.py");
    assert.equal(prepared.mimeType, "text/plain");
    assert.equal(
      prepared.contentBase64,
      Buffer.from("print(1)", "utf8").toString("base64")
    );
  });
});
