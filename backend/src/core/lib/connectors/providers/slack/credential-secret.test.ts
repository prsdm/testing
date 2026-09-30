import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSlackCredentialSecretPayload } from "./credential-secret";

describe("buildSlackCredentialSecretPayload", () => {
  it("stores refresh token and expires_at when rotation fields present", () => {
    const before = Date.now();
    const raw = buildSlackCredentialSecretPayload({
      accessToken: "xoxp-access",
      expiresIn: 43_200,
      refreshToken: "xoxe-refresh",
      scope: "search:read",
      teamId: "T1",
      teamName: "Acme",
      teamUrl: "https://acme.slack.com",
      userEmail: "a@acme.com",
      userId: "U1",
    });
    const after = Date.now();
    const parsed = JSON.parse(raw) as {
      access_token: string;
      refresh_token: string;
      expires_at: number;
    };

    assert.equal(parsed.access_token, "xoxp-access");
    assert.equal(parsed.refresh_token, "xoxe-refresh");
    assert.ok(parsed.expires_at >= before + 43_200 * 1000);
    assert.ok(parsed.expires_at <= after + 43_200 * 1000);
  });

  it("omits expiry when Slack returns a long-lived token", () => {
    const raw = buildSlackCredentialSecretPayload({
      accessToken: "xoxp-access",
      expiresIn: null,
      refreshToken: null,
      scope: "search:read",
      teamId: null,
      teamName: null,
      teamUrl: null,
      userEmail: "a@acme.com",
      userId: null,
    });
    const parsed = JSON.parse(raw) as {
      refresh_token: string | null;
      expires_at: number | null;
    };
    assert.equal(parsed.refresh_token, null);
    assert.equal(parsed.expires_at, null);
  });
});
