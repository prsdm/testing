"use client";

import { usePathname } from "next/navigation";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AppSidebar } from "@/components/chat/app-sidebar";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { useSessionUser } from "@/components/providers/session-user-provider";
import { cn } from "@/shared/utils";

const ADMIN_ROUTE_PATTERN = /^\/admin(?:\/|$)/;

export function TenantShellSidebar({
  showAdminEntry,
}: {
  showAdminEntry: boolean;
}) {
  const pathname = usePathname();
  const user = useSessionUser();
  const { isOnboardingGateActive } = useOnboarding();
  const isAdminRoute = ADMIN_ROUTE_PATTERN.test(pathname);

  if (!user) {
    return null;
  }

  return (
    <div
      aria-hidden={isOnboardingGateActive}
      className={cn(
        "contents",
        isOnboardingGateActive &&
          "**:data-[sidebar=sidebar]:pointer-events-none **:data-[sidebar=sidebar]:select-none **:data-[sidebar=sidebar]:opacity-60"
      )}
    >
      {isAdminRoute ? (
        <AdminSidebar />
      ) : (
        <AppSidebar showAdminEntry={showAdminEntry} user={user} />
      )}
    </div>
  );
}
