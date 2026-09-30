import assert from "node:assert/strict";
import test from "node:test";
import { buildChatInstructions } from "@/core/lib/ai/chat-instructions";
import { loadAgentInstructions } from "@/core/lib/ai/load-agent-instructions";

test("loadAgentInstructions loads general agent guidance", () => {
  const instructions = loadAgentInstructions();
  assert.match(instructions, /^# Kimiro/m);
  assert.match(instructions, /## Session/);
  assert.match(instructions, /Hard rules/);
  assert.match(instructions, /Task planning/);
  assert.match(instructions, /Response channels/);
  assert.match(instructions, /Commentary is not Thought/);
  assert.doesNotMatch(instructions, /## Connected apps/);
  assert.doesNotMatch(instructions, /## Turn budget/);
  assert.doesNotMatch(instructions, /## How to work/);
  assert.doesNotMatch(instructions, /driveCreateFolder/);
  assert.doesNotMatch(instructions, /driveCreateSharedDrive/);
});

test("buildChatInstructions puts session context under Kimiro before rules", () => {
  const instructions = buildChatInstructions({
    userEmail: "admin@kimiro.ai",
    userName: "Kimiro Admin",
  });
  const introIndex = instructions.indexOf("You are Kimiro");
  const sessionIndex = instructions.indexOf("## Session");
  const userIndex = instructions.indexOf("Kimiro Admin");
  const rulesIndex = instructions.indexOf("## Hard rules");
  assert.ok(introIndex >= 0 && sessionIndex > introIndex);
  assert.ok(userIndex > sessionIndex && userIndex < rulesIndex);
  assert.match(instructions, /admin@kimiro.ai/);
  assert.match(instructions, /Hard rules/);
  assert.doesNotMatch(instructions, /^# User/m);
  assert.doesNotMatch(instructions, /\{\{CHAT_SESSION\}\}/);
});
