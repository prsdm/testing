import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSignedOAuthStateCookie,
  signOAuthStateCookie,
} from "./oauth/oauth-state";

process.env.BETTER_AUTH_SECRET ??= "test-oauth-state-secret-for-unit-tests";

describe("oauth state cookie signing", () => {
  it("round-trips a payload", () => {
    const signed = signOAuthStateCookie({
      nonce: "abc",
      tenantId: "t1",
      tenantSlug: "acme",
      userEmail: "a@acme.com",
      userId: "u1",
    });
    const parsed = parseSignedOAuthStateCookie<{
      tenantId: string;
      tenantSlug: string;
    }>(signed);
    assert.equal(parsed?.tenantId, "t1");
    assert.equal(parsed?.tenantSlug, "acme");
  });

  it("rejects tampered payloads", () => {
    const signed = signOAuthStateCookie({ tenantId: "t1" });
    const [, sig] = signed.split(".");
    assert.ok(sig);
    const tamperedBody = Buffer.from(
      JSON.stringify({
        iat: Date.now(),
        payload: { tenantId: "other-tenant" },
        v: 1,
      }),
      "utf8"
    ).toString("base64url");
    assert.equal(parseSignedOAuthStateCookie(`${tamperedBody}.${sig}`), null);
  });

  it("rejects truncated signatures", () => {
    const signed = signOAuthStateCookie({ tenantId: "t1" });
    assert.equal(parseSignedOAuthStateCookie(signed.slice(0, -4)), null);
  });

  it("rejects unsigned JSON cookies", () => {
    assert.equal(
      parseSignedOAuthStateCookie(
        JSON.stringify({ tenantId: "t1", userId: "u1" })
      ),
      null
    );
  });
});
