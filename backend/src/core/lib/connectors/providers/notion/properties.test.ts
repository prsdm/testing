import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findTitlePropertyKey } from "./properties";

describe("notion properties", () => {
  it("finds the title property key in a schema", () => {
    assert.equal(
      findTitlePropertyKey({
        Name: { type: "title" },
        Status: { type: "select" },
      }),
      "Name"
    );
  });
});
