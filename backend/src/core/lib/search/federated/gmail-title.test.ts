import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gmailFromDisplayName } from "./gmail-title";

describe("gmailFromDisplayName", () => {
  it("extracts display name from angle-bracket form", () => {
    assert.equal(
      gmailFromDisplayName("Kimiro Admin <admin@kimiro.ai>"),
      "Kimiro Admin"
    );
  });

  it("returns raw value when no display name", () => {
    assert.equal(gmailFromDisplayName("admin@kimiro.ai"), "admin@kimiro.ai");
  });
});
