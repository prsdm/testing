import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSlackFederatedTitle,
  isOpaqueSlackChannelLabel,
} from "./slack-title";

describe("isOpaqueSlackChannelLabel", () => {
  it("flags slack-style ids and opaque tokens", () => {
    assert.equal(isOpaqueSlackChannelLabel("C0123456789"), true);
    assert.equal(isOpaqueSlackChannelLabel("UOBBYNLASTX"), true);
    assert.equal(isOpaqueSlackChannelLabel("eng"), false);
    assert.equal(isOpaqueSlackChannelLabel("website-tasks"), false);
  });
});

describe("buildSlackFederatedTitle", () => {
  it("uses readable channel names", () => {
    assert.equal(
      buildSlackFederatedTitle({
        channelName: "eng",
        text: "hello",
      }),
      "#eng"
    );
  });

  it("uses author name for opaque channels", () => {
    assert.equal(
      buildSlackFederatedTitle({
        channelName: "UOBBYNLASTX",
        text: "Hi Shubham — here are your current tasks",
        userName: "admin",
      }),
      "admin"
    );
  });

  it("uses author name for direct messages", () => {
    assert.equal(
      buildSlackFederatedTitle({
        isIm: true,
        text: "Hi Shubham — here are your current tasks",
        userName: "admin",
      }),
      "admin"
    );
  });

  it("falls back when author is missing", () => {
    assert.equal(
      buildSlackFederatedTitle({
        isIm: true,
        text: "hello",
      }),
      "Slack DM"
    );
  });
});
