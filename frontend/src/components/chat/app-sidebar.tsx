"use client";

import {
  BookTextIcon,
  FolderKanbanIcon,
  FolderOpenIcon,
  LayoutGridIcon,
  PenSquareIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChatSearchDialog } from "@/components/chat/chat-search-dialog";
import { CollapsedSidebarExpandSurface } from "@/components/chat/collapsed-sidebar-expand-surface";
import { SidebarBrandHeader } from "@/components/chat/sidebar-brand-header";
import { SidebarChannels } from "@/components/chat/sidebar-channels";
import { SidebarDirectMessages } from "@/components/chat/sidebar-dms";
import { SidebarHistory } from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useBeginNewChat } from "@/hooks/use-active-chat";
import { useWorkspaceInboxEvents } from "@/hooks/use-workspace-inbox-events";
import type { SessionUser } from "@/shared/auth/types";
import { CHAT_HOME, isChatHomePath } from "@/shared/chat/routes";
import { cn } from "@/shared/utils";

type AppNavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  segment: string;
};

export function AppSidebar({
  user,
  showAdminEntry = false,
}: {
  user: SessionUser | undefined;
  showAdminEntry?: boolean;
}) {
  const pathname = usePathname();
  const tenantSlug = useTenantSlug();
  const { setOpenMobile } = useSidebar();
  const beginNewChat = useBeginNewChat();
  const [searchOpen, setSearchOpen] = useState(false);

  useWorkspaceInboxEvents(tenantSlug);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const chatHome = CHAT_HOME;
  const connectorsHome = "/connectors";
  const sourcesHome = "/sources";
  const knowledgeBasesHome = "/knowledge-bases";
  const libraryHome = "/library";
  const adminHome = "/admin";
  const activeSegment = segments.at(0) ?? "";

  const workspaceNavItems: AppNavItem[] = [
    {
      href: connectorsHome,
      icon: LayoutGridIcon,
      label: "Connectors",
      segment: "connectors",
    },
    {
      href: knowledgeBasesHome,
      icon: FolderKanbanIcon,
      label: "Knowledge base",
      segment: "knowledge-bases",
    },
    {
      href: libraryHome,
      icon: FolderOpenIcon,
      label: "Library",
      segment: "library",
    },
    {
      href: sourcesHome,
      icon: BookTextIcon,
      label: "Sources",
      segment: "sources",
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <CollapsedSidebarExpandSurface>
        <SidebarHeader className="pb-4 pt-3">
          <SidebarBrandHeader
            adminSettingsHref={showAdminEntry ? adminHome : undefined}
            href={chatHome}
            onAdminNavigate={() => setOpenMobile(false)}
            onNavigate={() => setOpenMobile(false)}
            searchAction={{
              label: "Search chats (⌘K)",
              onClick: () => {
                setOpenMobile(false);
                setSearchOpen(true);
              },
            }}
          />
        </SidebarHeader>
        <SidebarContent className="gap-0">
          <SidebarGroup className="pt-4">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-8 text-[14px] transition-colors duration-150",
                      isChatHomePath(pathname)
                        ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:font-medium hover:text-sidebar-foreground"
                    )}
                    isActive={isChatHomePath(pathname)}
                    tooltip="New chat"
                  >
                    <Link
                      href={chatHome}
                      onClick={(event) => {
                        setOpenMobile(false);
                        if (isChatHomePath(pathname)) {
                          event.preventDefault();
                          beginNewChat();
                        }
                      }}
                    >
                      <PenSquareIcon className="size-4" />
                      <span>New chat</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {workspaceNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeSegment === item.segment;
                  return (
                    <SidebarMenuItem key={item.segment}>
                      <SidebarMenuButton
                        asChild
                        className={cn(
                          "h-8 text-[14px] transition-colors duration-150",
                          isActive
                            ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:font-medium hover:text-sidebar-foreground"
                        )}
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setOpenMobile(false)}
                        >
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarChannels />

          <SidebarDirectMessages />

          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter className="gap-1 pt-2 pb-3 group-data-[collapsible=icon]:px-1">
          {user ? <SidebarUserNav user={user} /> : null}
        </SidebarFooter>
        <ChatSearchDialog onOpenChange={setSearchOpen} open={searchOpen} />
      </CollapsedSidebarExpandSurface>
    </Sidebar>
  );
}
