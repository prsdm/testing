import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectSlackUserMentionIds,
  formatSlackMessageText,
} from "./resolve-users";

describe("collectSlackUserMentionIds", () => {
  it("collects user ids from mention markup", () => {
    assert.deepEqual(
      collectSlackUserMentionIds([
        "Welcome <@U0BC26KMH6Y> to the team",
        "Ping <@U123ABC456>",
      ]),
      ["U0BC26KMH6Y", "U123ABC456"]
    );
  });
});

describe("formatSlackMessageText", () => {
  it("replaces Slack user mentions with display names", () => {
    const userNames = new Map([["U0BC26KMH6Y", "Alex"]]);
    assert.equal(
      formatSlackMessageText("Welcome <@U0BC26KMH6Y> to the team", userNames),
      "Welcome @Alex to the team"
    );
  });
});
