import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSafeUrl } from "@/core/lib/web-search/crawl/builtin";

describe("isSafeUrl SSRF guards", () => {
  it("allows public https urls", () => {
    assert.equal(isSafeUrl("https://example.com/page"), true);
  });

  it("rejects localhost and private literals", () => {
    assert.equal(isSafeUrl("http://localhost/admin"), false);
    assert.equal(isSafeUrl("http://127.0.0.1/"), false);
    assert.equal(isSafeUrl("http://10.0.0.5/"), false);
    assert.equal(isSafeUrl("http://192.168.1.1/"), false);
    assert.equal(isSafeUrl("http://169.254.169.254/latest"), false);
    assert.equal(isSafeUrl("http://[::1]/"), false);
  });

  it("rejects protocol-relative and credentialed urls", () => {
    assert.equal(isSafeUrl("https://user:pass@example.com/"), false);
  });
});
