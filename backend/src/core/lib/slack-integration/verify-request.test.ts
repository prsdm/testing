import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import { verifySlackRequestSignature } from "./verify-request";

function signBody(args: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
}) {
  const base = `v0:${args.timestamp}:${args.rawBody}`;
  return `v0=${crypto
    .createHmac("sha256", args.signingSecret)
    .update(base)
    .digest("hex")}`;
}

describe("verifySlackRequestSignature", () => {
  it("accepts a valid Slack signature", () => {
    const signingSecret = "test-signing-secret";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = '{"type":"event_callback","event":{"type":"app_mention"}}';
    const signature = signBody({ rawBody, signingSecret, timestamp });

    assert.equal(
      verifySlackRequestSignature({
        rawBody,
        signature,
        signingSecret,
        timestamp,
      }),
      true
    );
  });

  it("rejects an invalid signature", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = '{"type":"event_callback"}';

    assert.equal(
      verifySlackRequestSignature({
        rawBody,
        signature: "v0=deadbeef",
        signingSecret: "secret-a",
        timestamp,
      }),
      false
    );
  });

  it("rejects stale timestamps", () => {
    const signingSecret = "test-signing-secret";
    const timestamp = Math.floor(Date.now() / 1000 - 600).toString();
    const rawBody = '{"type":"event_callback"}';
    const signature = signBody({ rawBody, signingSecret, timestamp });

    assert.equal(
      verifySlackRequestSignature({
        maxAgeSeconds: 300,
        rawBody,
        signature,
        signingSecret,
        timestamp,
      }),
      false
    );
  });
});
