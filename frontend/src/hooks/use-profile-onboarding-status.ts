"use client";

import useSWR from "swr";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { useTenant } from "@/components/providers/tenant-provider";
import {
  getProfileOnboardingStatusUrl,
  type ProfileOnboardingStatus,
} from "@/shared/onboarding/profile-status";

async function fetchProfileOnboardingStatus(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load profile onboarding status.");
  }
  return (await response.json()) as ProfileOnboardingStatus;
}

export function useProfileOnboardingStatus() {
  const user = useSessionUser();
  const { tenantSlug } = useTenant();
  const url = user?.id ? getProfileOnboardingStatusUrl(tenantSlug) : null;

  const swr = useSWR<ProfileOnboardingStatus>(
    url,
    fetchProfileOnboardingStatus
  );

  return {
    ...swr,
    hasCompletedProfile: swr.data ? !swr.data.needsProfileSetup : false,
    isLoading: Boolean(url) && (swr.isLoading || swr.data === undefined),
    needsProfileSetup: swr.data?.needsProfileSetup ?? false,
    profile: swr.data?.profile ?? null,
  };
}
