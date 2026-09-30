import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DOCX_DRIVE_MIME } from "@/shared/artifacts/prepare-drive-export";
import { libraryDriveMimeType } from "@/shared/library/content-type";
import {
  isLibraryCloudExportSupported,
  isLibraryCloudExportSupportedKind,
  libraryGoogleAppsTargetMime,
} from "@/shared/library/library-preview-kind";

describe("library cloud export", () => {
  it("detects exportable preview kinds", () => {
    assert.equal(isLibraryCloudExportSupportedKind("text"), true);
    assert.equal(isLibraryCloudExportSupportedKind("image"), false);
    assert.equal(
      isLibraryCloudExportSupported({
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        name: "Report.docx",
      }),
      true
    );
  });

  it("maps office files to native Google apps mime types", () => {
    assert.equal(
      libraryGoogleAppsTargetMime({
        contentType: DOCX_DRIVE_MIME,
        name: "Report.docx",
      }),
      "application/vnd.google-apps.document"
    );
    assert.equal(
      libraryGoogleAppsTargetMime({
        contentType: "application/pdf",
        name: "Report.pdf",
      }),
      null
    );
  });

  it("resolves drive mime types from filenames", () => {
    assert.equal(
      libraryDriveMimeType({
        contentType: "application/octet-stream",
        name: "Budget.xlsx",
      }),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    assert.equal(
      libraryDriveMimeType({
        contentType: "application/octet-stream",
        name: "Deck.pptx",
      }),
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
  });
});
