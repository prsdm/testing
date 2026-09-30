import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BASIC_DEFAULT_CAPABILITIES,
  CAPABILITY_IDS,
  hasAnyAdminCapability,
  hasCapability,
  resolveCapabilitiesFromParts,
} from "./capabilities";

describe("capabilities", () => {
  it("gives full admins every capability", () => {
    const caps = resolveCapabilitiesFromParts({
      customCapabilities: [],
      isFullAdmin: true,
    });
    assert.equal(caps.size, CAPABILITY_IDS.length);
    assert.equal(hasCapability(caps, "admin.roles"), true);
  });

  it("gives basic users no default capabilities", () => {
    const caps = resolveCapabilitiesFromParts({
      customCapabilities: [],
      isFullAdmin: false,
    });
    assert.deepEqual([...caps].sort(), [...BASIC_DEFAULT_CAPABILITIES].sort());
    assert.equal(hasAnyAdminCapability(caps), false);
  });

  it("uses only custom role capabilities when a custom role is assigned", () => {
    const caps = resolveCapabilitiesFromParts({
      customCapabilities: ["admin.models"],
      hasCustomRole: true,
      isFullAdmin: false,
    });
    assert.equal(hasCapability(caps, "admin.models"), true);
    assert.equal(hasCapability(caps, "admin.users"), false);
    assert.equal(hasAnyAdminCapability(caps), true);
  });

  it("gives no capabilities for a custom role with an empty checklist", () => {
    const caps = resolveCapabilitiesFromParts({
      customCapabilities: [],
      hasCustomRole: true,
      isFullAdmin: false,
    });
    assert.equal(caps.size, 0);
  });
});
