"use client";

import {
  ChevronUp,
  CircleUser,
  LogOut,
  Palette,
  PanelLeftIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppearanceThemeMenuItems } from "@/components/chat/appearance-theme-options";
import { UserAvatar } from "@/components/chat/user-avatar";
import { UserProfileDialog } from "@/components/chat/user-profile-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProfileOnboardingStatus } from "@/hooks/use-profile-onboarding-status";
import { useWorkspace } from "@/hooks/use-workspace";
import type { SessionUser } from "@/shared/auth/types";
import { resolveKimiroAddressName } from "@/shared/kimiro-user-name";
import { getUserDisplayName } from "@/shared/user-display";
import { toast } from "./toast";

export function SidebarUserNav({ user }: { user: SessionUser }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const [profileOpen, setProfileOpen] = useState(false);
  const { profile } = useProfileOnboardingStatus();
  const { workspace } = useWorkspace();
  const planLabel = workspace?.planLabel?.trim() || null;
  const fullDisplayName = getUserDisplayName({
    email: user.email,
    name: profile?.name ?? user.name,
  });
  const displayName = useMemo(() => {
    const addressName = resolveKimiroAddressName({
      fullName: profile?.name ?? user.name,
      preferredName: profile?.preferredName,
    });
    return addressName ?? fullDisplayName;
  }, [fullDisplayName, profile?.name, profile?.preferredName, user.name]);

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center gap-0.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                className="h-auto min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 bg-transparent px-2.5 py-1.5 text-[14px] text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent hover:font-medium hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:font-medium data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:min-h-0! group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:shrink-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:overflow-visible! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:hover:bg-sidebar-accent"
                data-testid="user-nav-button"
                tooltip={
                  user.email
                    ? `${fullDisplayName} (${user.email})`
                    : fullDisplayName
                }
              >
                <UserAvatar
                  className="shrink-0"
                  email={user.email}
                  image={user.image}
                  name={user.name}
                  priority
                  size="nav"
                  userId={user.id}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0 leading-none group-data-[collapsible=icon]:hidden">
                  <span
                    className="truncate font-medium text-[14px] leading-tight text-sidebar-foreground"
                    data-testid="user-name"
                  >
                    {displayName}
                  </span>
                  {planLabel ? (
                    <span
                      className="truncate text-[12px] leading-tight text-sidebar-foreground/60"
                      data-testid="user-plan"
                    >
                      {planLabel}
                    </span>
                  ) : null}
                </div>
                <ChevronUp className="ml-auto size-3.5 shrink-0 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-popper-anchor-width) overflow-visible rounded-lg border border-border/60 bg-card/95 backdrop-blur-xl shadow-(--shadow-float)"
              data-testid="user-nav-menu"
              side="top"
            >
              <DropdownMenuItem
                className="cursor-pointer text-[14px]"
                data-testid="user-nav-item-profile"
                onSelect={() => setProfileOpen(true)}
              >
                <CircleUser />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="cursor-pointer text-[14px]"
                  data-testid="user-nav-item-appearance"
                >
                  <Palette />
                  Appearance
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="z-100 min-w-52 rounded-lg border border-border/60 bg-card/95 p-1 backdrop-blur-xl shadow-(--shadow-float)">
                  <AppearanceThemeMenuItems />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild data-testid="user-nav-item-auth">
                <button
                  className="flex w-full cursor-pointer items-center gap-2.5 text-[14px]"
                  onClick={async () => {
                    const response = await fetch("/api/auth/sign-out", {
                      body: "{}",
                      headers: {
                        "content-type": "application/json",
                      },
                      method: "POST",
                    });

                    if (!response.ok) {
                      toast({
                        description: "Unable to sign out. Please try again.",
                        type: "error",
                      });
                      return;
                    }

                    router.push("/login");
                    router.refresh();
                  }}
                  type="button"
                >
                  <LogOut />
                  Sign out
                </button>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SidebarMenuButton
            className="size-10! h-10! w-10! shrink-0 justify-center gap-0 bg-transparent p-0! text-sidebar-foreground/70 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground group-data-[collapsible=icon]:hidden"
            onClick={() => toggleSidebar()}
            tooltip="Close sidebar"
            type="button"
          >
            <PanelLeftIcon className="size-4 shrink-0" />
            <span className="sr-only">Close sidebar</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <UserProfileDialog
        onOpenChange={setProfileOpen}
        open={profileOpen}
        user={user}
      />
    </>
  );
}
