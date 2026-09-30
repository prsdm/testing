import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDriveNameSearchQuery } from "./find-query";

describe("google-drive resolve by name", () => {
  it("builds folder search queries", () => {
    assert.equal(
      buildDriveNameSearchQuery({
        folderOnly: true,
        name: "marketing team",
      }),
      "name contains 'marketing team' and trashed = false and mimeType = 'application/vnd.google-apps.folder'"
    );
  });
});
