import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONNECTOR_SPACE_GROUP_PREFIX,
  isConnectorSpaceGroupId,
} from "./connector-membership-ids";

describe("connector membership space groups", () => {
  it("detects Confluence space-scoped group ids", () => {
    assert.equal(CONNECTOR_SPACE_GROUP_PREFIX, "space:");
    assert.equal(isConnectorSpaceGroupId("space:abc"), true);
    assert.equal(isConnectorSpaceGroupId("SPACE:abc"), true);
    assert.equal(isConnectorSpaceGroupId("group:abc"), false);
  });
});
