export const CHAT_AGENT_MAX_STEPS = 50;
export const CHAT_AGENT_SOFT_STEP_BUDGET = 40;

/** Injected near the step limit so the model converges instead of looping. */
export function buildStepBudgetNudge(stepNumber: number): string | null {
  if (stepNumber < CHAT_AGENT_SOFT_STEP_BUDGET) {
    return null;
  }

  const currentStep = stepNumber + 1;
  const remaining = CHAT_AGENT_MAX_STEPS - currentStep;
  if (remaining <= 0) {
    return `[Turn budget] Step ${currentStep} of ${CHAT_AGENT_MAX_STEPS}. Stop calling new tools. Finish open todo steps or give a concise final answer now.`;
  }

  return `[Turn budget] Step ${currentStep} of ${CHAT_AGENT_MAX_STEPS} (~${remaining} left). Converge: complete or skip remaining planned steps, then answer — do not start unrelated work.`;
}
