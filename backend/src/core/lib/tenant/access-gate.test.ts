import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateTenantAccess, matchesAllowedOrgUnits } from "./access-gate";

describe("evaluateTenantAccess for multi-tenant self-serve", () => {
  it("allows members with no directory person or OU policy", () => {
    assert.equal(
      evaluateTenantAccess({
        allowedOrgUnits: [],
        memberAllowed: true,
        personOrgUnit: null,
        personStatus: null,
      }),
      null
    );
  });

  it("blocks inactive members", () => {
    assert.equal(
      evaluateTenantAccess({
        allowedOrgUnits: [],
        memberAllowed: false,
        personOrgUnit: null,
        personStatus: null,
      }),
      "inactive_member"
    );
  });

  it("blocks inactive people", () => {
    assert.equal(
      evaluateTenantAccess({
        allowedOrgUnits: [],
        memberAllowed: true,
        personOrgUnit: null,
        personStatus: "inactive",
      }),
      "inactive_person"
    );
  });
});

describe("matchesAllowedOrgUnits", () => {
  it("allows when no OU prefixes configured", () => {
    assert.equal(
      matchesAllowedOrgUnits({
        allowedOrgUnits: [],
        personOrgUnit: null,
      }),
      true
    );
  });
});
