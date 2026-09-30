import assert from "node:assert/strict";
import test from "node:test";
import { canAccessChatWorkflowRun } from "./chat-workflow-access";

const expected = {
  authUserId: "user-1",
  chatId: "5f933f8e-c999-4bcf-a37c-585140cdd7a8",
};

test("requires both chat ownership and the authenticated run owner", () => {
  assert.equal(canAccessChatWorkflowRun(expected, expected), true);
  assert.equal(
    canAccessChatWorkflowRun({ ...expected, chatId: "other-chat" }, expected),
    false
  );
  assert.equal(
    canAccessChatWorkflowRun({ ...expected, authUserId: "user-2" }, expected),
    false
  );
  assert.equal(canAccessChatWorkflowRun(null, expected), false);
});
