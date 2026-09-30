import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isValidInviteEmail, parseInviteEmails } from "./parse-invite-emails";

describe("parseInviteEmails", () => {
  it("splits on commas, spaces, and newlines", () => {
    assert.deepEqual(parseInviteEmails("a@x.com, b@y.com\nc@z.com;d@w.com"), [
      "a@x.com",
      "b@y.com",
      "c@z.com",
      "d@w.com",
    ]);
  });

  it("dedupes and lowercases", () => {
    assert.deepEqual(parseInviteEmails("A@X.com  a@x.com, B@Y.com"), [
      "a@x.com",
      "b@y.com",
    ]);
  });

  it("returns empty for blank input", () => {
    assert.deepEqual(parseInviteEmails("  ,  \n "), []);
  });
});

describe("isValidInviteEmail", () => {
  it("accepts simple emails", () => {
    assert.equal(isValidInviteEmail("alex@company.com"), true);
  });

  it("rejects incomplete emails", () => {
    assert.equal(isValidInviteEmail("alex@"), false);
    assert.equal(isValidInviteEmail("not-an-email"), false);
  });
});
