"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect } from "react";
import { useShowOnboarding } from "@/hooks/use-show-onboarding";
import { CHAT_HOME, isChatHomePath } from "@/shared/chat/routes";

type OnboardingContextValue = ReturnType<typeof useShowOnboarding>;

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const onboarding = useShowOnboarding();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!onboarding.shouldRedirectForOnboarding) {
      return;
    }
    if (!isChatHomePath(pathname)) {
      router.replace(CHAT_HOME);
    }
  }, [onboarding.shouldRedirectForOnboarding, pathname, router]);

  return (
    <OnboardingContext.Provider value={onboarding}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return context;
}
