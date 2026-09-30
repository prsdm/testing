"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { useTenant } from "@/components/providers/tenant-provider";
import { useProfileOnboardingStatus } from "@/hooks/use-profile-onboarding-status";
import { getOnboardingCompletedKey } from "@/lib/onboarding/constants";
import type { OnboardingStep } from "@/lib/onboarding/types";

export function useShowOnboarding() {
  const user = useSessionUser();
  const { tenantSlug, isAdmin } = useTenant();
  const userId = user?.id;
  const {
    needsProfileSetup,
    hasCompletedProfile,
    isLoading: isLoadingProfileStatus,
    mutate: mutateProfileStatus,
  } = useProfileOnboardingStatus();

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [isNextEnabled, setIsNextEnabled] = useState(false);
  const initializedProfileOnboardingRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const dismissed =
      localStorage.getItem(getOnboardingCompletedKey(userId)) === "true";
    setOnboardingDismissed(dismissed);
  }, [userId]);

  useEffect(() => {
    if (!userId || isLoadingProfileStatus || needsProfileSetup) {
      return;
    }
    if (onboardingDismissed) {
      return;
    }
    localStorage.setItem(getOnboardingCompletedKey(userId), "true");
    setOnboardingDismissed(true);
  }, [userId, isLoadingProfileStatus, needsProfileSetup, onboardingDismissed]);

  const showProfileOnboarding = useMemo(() => {
    if (isLoadingProfileStatus || !needsProfileSetup || onboardingDismissed) {
      return false;
    }
    return true;
  }, [isLoadingProfileStatus, needsProfileSetup, onboardingDismissed]);

  /** @deprecated Prefer showProfileOnboarding */
  const showNamePrompt = showProfileOnboarding;

  const dismissOnboarding = useCallback(() => {
    if (!userId) {
      return;
    }
    localStorage.setItem(getOnboardingCompletedKey(userId), "true");
    setOnboardingDismissed(true);
  }, [userId]);

  const finishOnboarding = dismissOnboarding;

  const goToStep = useCallback((step: OnboardingStep) => {
    setCurrentStep(step);
  }, []);

  const refreshProfileStatus = useCallback(async () => {
    await mutateProfileStatus();
  }, [mutateProfileStatus]);

  useEffect(() => {
    if (!showProfileOnboarding) {
      initializedProfileOnboardingRef.current = false;
      return;
    }
    if (initializedProfileOnboardingRef.current) {
      return;
    }
    initializedProfileOnboardingRef.current = true;
    setCurrentStep("welcome");
    setIsNextEnabled(true);
  }, [showProfileOnboarding]);

  useEffect(() => {
    if (currentStep === "welcome") {
      setIsNextEnabled(true);
    }
    if (currentStep === "name") {
      setIsNextEnabled(hasCompletedProfile);
    }
  }, [currentStep, hasCompletedProfile]);

  const chatBlockedByProfileSetup = needsProfileSetup && !onboardingDismissed;
  const isOnboardingGateActive =
    isLoadingProfileStatus || showProfileOnboarding;
  const shouldRedirectForOnboarding =
    !isLoadingProfileStatus && showProfileOnboarding;
  const isChatComposerBlocked =
    isLoadingProfileStatus || chatBlockedByProfileSetup;

  const composerBlockedMessage = isLoadingProfileStatus
    ? "Loading workspace setup…"
    : chatBlockedByProfileSetup
      ? "Complete your profile to start chatting."
      : null;

  return {
    composerBlockedMessage,
    currentStep,
    dismissOnboarding,
    finishOnboarding,
    goToStep,
    hasCompletedProfile,
    isAdmin,
    isChatComposerBlocked,
    isLoadingProfileStatus,
    isNextEnabled,
    isOnboardingGateActive,
    needsProfileSetup,
    refreshProfileStatus,
    setIsNextEnabled,
    shouldRedirectForOnboarding,
    showNamePrompt,
    showProfileOnboarding,
    tenantSlug,
    userId,
  };
}
