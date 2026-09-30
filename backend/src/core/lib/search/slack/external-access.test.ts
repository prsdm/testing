import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSlackChannelAccessControlList,
  slackMessageDocumentId,
} from "@/core/lib/search/slack/external-access";

describe("buildSlackChannelAccessControlList", () => {
  it("stamps user_email tokens and fails closed on empty", () => {
    assert.deepEqual(buildSlackChannelAccessControlList([]), []);
    assert.deepEqual(
      buildSlackChannelAccessControlList([
        "Ada@Example.com",
        "  bob@example.com ",
        "not-an-email",
        "",
      ]),
      ["user_email:ada@example.com", "user_email:bob@example.com"]
    );
  });

  it("never includes PUBLIC or tenant tokens", () => {
    const acl = buildSlackChannelAccessControlList(["priya@acme.com"]);
    assert.ok(acl.every((token) => token.startsWith("user_email:")));
    assert.ok(
      !acl.some((token) => token === "PUBLIC" || token.startsWith("tenant:"))
    );
  });
});

describe("slackMessageDocumentId", () => {
  it("matches live federated id shape for RRF dedupe", () => {
    assert.equal(
      slackMessageDocumentId("C0123", "1710000000.000100"),
      "slack:C0123:1710000000.000100"
    );
  });
});
