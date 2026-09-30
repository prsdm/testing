import type { OnboardingStep } from "./types";

export const ONBOARDING_COMPLETED_STORAGE_PREFIX =
  "kimiro:onboardingCompleted:";

export function getOnboardingCompletedKey(userId: string) {
  return `${ONBOARDING_COMPLETED_STORAGE_PREFIX}${userId}`;
}

export const ONBOARDING_ADMIN_STEPS = [
  "welcome",
  "name",
  "llm",
] as const satisfies readonly OnboardingStep[];
