"use client";

import { useSessionUser } from "@/components/providers/session-user-provider";
import { useProfileOnboardingStatus } from "@/hooks/use-profile-onboarding-status";
import { buildGreetingHeadline } from "@/lib/chat/greeting-message";
import { getUserFirstName } from "@/shared/user-display";

export function Greeting() {
  const user = useSessionUser();
  const { needsProfileSetup, profile } = useProfileOnboardingStatus();

  const firstName =
    user && !needsProfileSetup && profile?.name
      ? getUserFirstName({ email: user.email, name: profile.name })
      : null;
  const greeting = buildGreetingHeadline(firstName);

  return (
    <div
      className="mx-auto flex max-w-3xl flex-col items-center justify-center px-4"
      key="overview"
    >
      <h1 className="text-center font-medium text-[1.75rem] text-foreground tracking-tight">
        {greeting}
      </h1>
    </div>
  );
}
