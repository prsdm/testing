"use client";

import {
  OnboardingNameStep,
  OnboardingWelcomeStep,
} from "@/components/onboarding/onboarding-steps";
import { useProfileOnboardingStatus } from "@/hooks/use-profile-onboarding-status";
import type { useShowOnboarding } from "@/hooks/use-show-onboarding";

type OnboardingState = ReturnType<typeof useShowOnboarding>;

export function ChatOnboarding({
  onboarding,
}: {
  onboarding: OnboardingState;
}) {
  const { profile } = useProfileOnboardingStatus();

  if (!onboarding.showProfileOnboarding) {
    return null;
  }

  if (onboarding.currentStep === "welcome") {
    return (
      <div className="w-full" data-testid="onboarding-flow">
        <OnboardingWelcomeStep
          description="Set up your profile to start chatting."
          onContinue={() => {
            onboarding.goToStep("name");
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="onboarding-flow">
      <OnboardingNameStep
        initialDepartment={profile?.department ?? ""}
        initialJobTitle={profile?.jobTitle ?? ""}
        initialName={profile?.name ?? ""}
        initialPreferredName={profile?.preferredName ?? ""}
        onBack={() => {
          onboarding.goToStep("welcome");
        }}
        onSaved={() => {
          onboarding.finishOnboarding();
          onboarding.refreshProfileStatus().catch(() => undefined);
        }}
        saveLabel="Save and finish"
        showBack
      />
    </div>
  );
}
