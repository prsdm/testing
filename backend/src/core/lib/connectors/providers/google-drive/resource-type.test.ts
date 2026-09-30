import assert from "node:assert/strict";
import test from "node:test";
import {
  driveResourceType,
  enrichDriveRecord,
  GOOGLE_FOLDER_MIME,
} from "./resource-type";

test("driveResourceType distinguishes folders, shared drives, and files", () => {
  assert.equal(driveResourceType({ mimeType: GOOGLE_FOLDER_MIME }), "folder");
  assert.equal(driveResourceType({ kind: "drive#drive" }), "shared_drive");
  assert.equal(
    driveResourceType({ mimeType: "application/vnd.google-apps.document" }),
    "google_doc"
  );
  assert.equal(driveResourceType({ mimeType: "text/plain" }), "file");
});

test("enrichDriveRecord adds resourceType to tool results", () => {
  const enriched = enrichDriveRecord({
    id: "abc",
    mimeType: GOOGLE_FOLDER_MIME,
    name: "Finance",
  });

  assert.equal(enriched.resourceType, "folder");
  assert.equal(enriched.mimeType, GOOGLE_FOLDER_MIME);
});
