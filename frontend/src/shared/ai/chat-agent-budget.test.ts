import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStepBudgetNudge,
  CHAT_AGENT_MAX_STEPS,
  CHAT_AGENT_SOFT_STEP_BUDGET,
} from "@/shared/ai/chat-agent-budget";

test("buildStepBudgetNudge stays silent before the soft budget", () => {
  assert.equal(buildStepBudgetNudge(CHAT_AGENT_SOFT_STEP_BUDGET - 1), null);
});

test("buildStepBudgetNudge warns as steps approach the hard limit", () => {
  const nudge = buildStepBudgetNudge(CHAT_AGENT_SOFT_STEP_BUDGET);
  assert.match(nudge ?? "", /Turn budget/);
  assert.match(nudge ?? "", new RegExp(String(CHAT_AGENT_MAX_STEPS)));
});

test("buildStepBudgetNudge demands convergence at the hard limit", () => {
  const nudge = buildStepBudgetNudge(CHAT_AGENT_MAX_STEPS - 1);
  assert.match(nudge ?? "", /Stop calling new tools/);
});
