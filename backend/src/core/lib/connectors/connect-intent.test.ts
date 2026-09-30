import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  matchConnectIntentKeys,
  resolveConnectCtasForUserMessage,
} from "./connect-intent";

describe("matchConnectIntentKeys", () => {
  it("detects jira from user wording", () => {
    assert.deepEqual(matchConnectIntentKeys("what jira tickets i have"), [
      "jira",
    ]);
  });

  it("detects gmail from email wording", () => {
    assert.deepEqual(matchConnectIntentKeys("check my emails"), ["gmail"]);
  });

  it("ignores unrelated messages", () => {
    assert.deepEqual(matchConnectIntentKeys("summarize my docs"), []);
  });
});

describe("resolveConnectCtasForUserMessage", () => {
  it("only returns CTA when the user connection is missing (latent)", () => {
    const ctas = resolveConnectCtasForUserMessage({
      latentIntegrations: [
        {
          connectLabel: "Connect Jira",
          connectUrl: "/api/connectors/oauth/jira?tenantSlug=acme",
          displayName: "Jira",
          integrationKey: "jira",
          providerId: "jira",
        },
      ],
      text: "what jira tickets i have",
    });
    assert.equal(ctas.length, 1);
    assert.equal(ctas[0]?.toolName, "jiraSearchIssues");
    assert.equal(ctas[0]?.connectLabel, "Connect Jira");
  });

  it("returns nothing when the user already has a connection (not latent)", () => {
    const ctas = resolveConnectCtasForUserMessage({
      latentIntegrations: [],
      text: "what jira tickets i have",
    });
    assert.deepEqual(ctas, []);
  });
});
