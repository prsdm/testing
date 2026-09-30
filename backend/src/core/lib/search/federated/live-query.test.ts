import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCalendarFederatedQuery,
  buildGmailFederatedQuery,
  buildSlackFederatedQuery,
  extractLiveSearchTokens,
  slackDmPersonCandidates,
} from "./live-query";

describe("live federated query builders", () => {
  it("strips conversation filler from tokens", () => {
    assert.deepEqual(
      extractLiveSearchTokens(
        "what is overall conversation i had with prasad so far"
      ),
      ["prasad"]
    );
  });

  it("builds gmail from/to query for a person", () => {
    assert.equal(
      buildGmailFederatedQuery("conversation with Prasad"),
      "from:prasad OR to:prasad OR prasad"
    );
  });

  it("does not AND filler tokens into gmail from/to groups", () => {
    assert.equal(
      buildGmailFederatedQuery("what i talked with prasad so far"),
      "from:prasad OR to:prasad OR prasad"
    );
  });

  it("strips the viewer email the model appends to person queries", () => {
    assert.equal(
      buildGmailFederatedQuery("conversations with Prasad admin@kimiro.ai", {
        viewerEmail: "admin@kimiro.ai",
      }),
      "from:prasad OR to:prasad OR prasad"
    );
  });

  it("keeps another person's email as from/to", () => {
    assert.equal(
      buildGmailFederatedQuery("conversations with Prasad prasad@acme.com", {
        viewerEmail: "admin@kimiro.ai",
      }),
      "(from:prasad OR to:prasad OR prasad) OR (from:prasad@acme.com OR to:prasad@acme.com)"
    );
  });

  it("keeps topic words alongside the person clause", () => {
    assert.equal(
      buildGmailFederatedQuery("marketing plan with prasad"),
      "(from:prasad OR to:prasad OR prasad) marketing plan"
    );
  });

  it("builds slack keyword query without filler", () => {
    assert.equal(
      buildSlackFederatedQuery("overall conversation with Prasad"),
      "prasad"
    );
  });

  it("builds calendar query without meeting filler", () => {
    assert.equal(
      buildCalendarFederatedQuery("meeting with Prasad on calendar"),
      "prasad"
    );
  });
});

describe("slackDmPersonCandidates", () => {
  it("picks person tokens for DM resolution", () => {
    assert.deepEqual(
      slackDmPersonCandidates("conversation with Prasad so far"),
      ["prasad"]
    );
  });
});
