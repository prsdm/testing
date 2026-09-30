export type OnboardingStep = "welcome" | "name" | "llm" | "complete";

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "name",
  "llm",
];

export function nextOnboardingStep(
  step: OnboardingStep
): OnboardingStep | null {
  const index = ONBOARDING_STEP_ORDER.indexOf(step);
  if (index < 0 || index >= ONBOARDING_STEP_ORDER.length - 1) {
    return null;
  }
  return ONBOARDING_STEP_ORDER[index + 1] ?? null;
}

export function previousOnboardingStep(
  step: OnboardingStep
): OnboardingStep | null {
  const index = ONBOARDING_STEP_ORDER.indexOf(step);
  if (index <= 0) {
    return null;
  }
  return ONBOARDING_STEP_ORDER[index - 1] ?? null;
}
