import assert from "node:assert/strict";
import test from "node:test";
import {
  getToolApprovalHeadline,
  getToolApprovalWarning,
} from "./tool-approval-display";

test("getToolApprovalHeadline uses verb and chip like connector tool cards", () => {
  assert.equal(
    getToolApprovalHeadline("driveUploadFile", {
      content: "hello",
      name: "sample.txt",
    }),
    "Creating Drive file sample.txt"
  );
  assert.equal(
    getToolApprovalHeadline("slackPostDirectMessage", {
      text: "Summary attached",
      user: "Prasad",
    }),
    "Sending Slack direct message Prasad"
  );
  assert.equal(
    getToolApprovalHeadline("slackPostDirectMessage", {
      text: "Summary attached",
      user: "UOBCSRLUM9N",
    }),
    "Sending Slack direct message"
  );
});

test("getToolApprovalHeadline resolves slack user ids from lookup", () => {
  const lookup = new Map([
    ["U0BCSRLUM9N", "Prasad"],
    ["U0BCSRLUM9N".toUpperCase(), "Prasad"],
  ]);
  assert.equal(
    getToolApprovalHeadline(
      "slackPostDirectMessage",
      {
        text: "Summary attached",
        user: "U0BCSRLUM9N",
      },
      lookup
    ),
    "Sending Slack direct message Prasad"
  );
});

test("getToolApprovalHeadline humanizes unknown tools", () => {
  assert.equal(getToolApprovalHeadline("todoWrite"), "todo Write");
});

test("getToolApprovalWarning flags shared drive mismatch", () => {
  assert.equal(
    getToolApprovalWarning(
      "driveCreateSharedDrive",
      { name: "Legal" },
      "Create folder Legal"
    ),
    "This creates a shared drive (team drive), not a My Drive folder."
  );
  assert.equal(
    getToolApprovalWarning(
      "driveCreateSharedDrive",
      { name: "Legal" },
      "Create a shared drive called Legal"
    ),
    undefined
  );
});
