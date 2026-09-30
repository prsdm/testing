import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeAppReturnTo } from "./safe-return-to";

describe("safeAppReturnTo", () => {
  it("allows known app paths", () => {
    assert.equal(safeAppReturnTo("/connectors", "acme"), "/connectors");
    assert.equal(safeAppReturnTo("/connectors?x=1", "acme"), "/connectors?x=1");
    assert.equal(safeAppReturnTo("/c/abc", "acme"), "/c/abc");
    assert.equal(safeAppReturnTo("/", "acme"), "/");
  });

  it("rejects protocol-relative open redirects", () => {
    assert.equal(safeAppReturnTo("//evil.com", "acme"), "/connectors");
    assert.equal(safeAppReturnTo("//evil.com/phish", "acme"), "/connectors");
  });

  it("rejects absolute and encoded redirects", () => {
    assert.equal(safeAppReturnTo("https://evil.com", "acme"), "/connectors");
    assert.equal(safeAppReturnTo("/\\evil.com", "acme"), "/connectors");
    assert.equal(safeAppReturnTo("/%2f%2fevil.com", "acme"), "/connectors");
  });

  it("rejects unknown paths", () => {
    assert.equal(safeAppReturnTo("/login", "acme"), "/connectors");
    assert.equal(safeAppReturnTo(null, "acme"), "/connectors");
  });
});
