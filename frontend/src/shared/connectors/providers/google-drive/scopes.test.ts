import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { googleOAuthScopesAllowDriveList } from "./scopes";

describe("googleOAuthScopesAllowDriveList", () => {
  it("accepts full drive or readonly, not drive.file alone", () => {
    assert.equal(
      googleOAuthScopesAllowDriveList(
        "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email"
      ),
      true
    );
    assert.equal(
      googleOAuthScopesAllowDriveList(
        "https://www.googleapis.com/auth/drive.readonly"
      ),
      true
    );
    assert.equal(
      googleOAuthScopesAllowDriveList(
        "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email"
      ),
      false
    );
    assert.equal(googleOAuthScopesAllowDriveList(""), false);
  });
});
