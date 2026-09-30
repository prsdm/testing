import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  expandKnowledgeSearchQueryForUser,
  formatKnowledgeSearchUserContext,
} from "./expand-source-search-query";

describe("expand kb search query", () => {
  it("appends user identity hints for first-person queries", () => {
    const expanded = expandKnowledgeSearchQueryForUser({
      query: "what bugs are assigned to me",
      userEmail: "prsdm@example.com",
      userName: "Pranav",
    });
    assert.match(expanded, /what bugs are assigned to me/);
    assert.match(expanded, /prsdm@example\.com/);
    assert.match(expanded, /prsdm/);
    assert.match(expanded, /Pranav/);
  });

  it("leaves non-first-person queries unchanged", () => {
    const expanded = expandKnowledgeSearchQueryForUser({
      query: "Bug Tracker in progress",
      userEmail: "prsdm@example.com",
      userName: "Pranav",
    });
    assert.equal(expanded, "Bug Tracker in progress");
  });
});

describe("format kb search user context", () => {
  it("includes name and email for the model", () => {
    const context = formatKnowledgeSearchUserContext({
      userEmail: "prsdm@example.com",
      userName: "Pranav",
    });
    assert.match(context ?? "", /Pranav \(prsdm@example\.com\)/);
    assert.match(context ?? "", /assigned to me/);
  });

  it("includes preferred address name when set", () => {
    const context = formatKnowledgeSearchUserContext({
      preferredName: "Pran",
      userEmail: "prsdm@example.com",
      userName: "Pranav Kumar",
    });
    assert.match(context ?? "", /Address the user as "Pran"/);
  });
});
