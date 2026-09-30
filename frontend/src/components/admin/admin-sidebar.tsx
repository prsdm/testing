"use client";

import {
  ArrowLeftIcon,
  BarChart3Icon,
  CpuIcon,
  CreditCardIcon,
  GlobeIcon,
  KeyRoundIcon,
  SettingsIcon,
  ShieldIcon,
  UnplugIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CollapsedSidebarExpandSurface } from "@/components/chat/collapsed-sidebar-expand-surface";
import { SidebarBrandHeader } from "@/components/chat/sidebar-brand-header";
import { McpIcon } from "@/components/icons/mcp-icon";
import { SlackMarkIcon } from "@/components/icons/slack-mark-icon";
import { useTenant } from "@/components/providers/tenant-provider";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { APP_TITLE } from "@/lib/metadata/page-titles";
import {
  ADMIN_NAV_CAPABILITY_BY_SEGMENT,
  type CapabilityId,
  hasCapability,
} from "@/shared/auth/capabilities";
import { CHAT_HOME } from "@/shared/chat/routes";

type AdminNavItem = {
  href: string;
  icon: typeof UserIcon | typeof SlackMarkIcon | typeof McpIcon;
  label: string;
  segment: string;
};

const navSections: AdminNavItem[][] = [
  [
    {
      href: "/admin/general",
      icon: SettingsIcon,
      label: "General",
      segment: "general",
    },
  ],
  [
    {
      href: "/admin/integrations",
      icon: UnplugIcon,
      label: "Integrations",
      segment: "integrations",
    },
    {
      href: "/admin/mcp",
      icon: McpIcon,
      label: "MCP servers",
      segment: "mcp",
    },
    {
      href: "/admin/slack-integration",
      icon: SlackMarkIcon,
      label: "Slack integration",
      segment: "slack-integration",
    },
    {
      href: "/admin/models",
      icon: CpuIcon,
      label: "Models",
      segment: "models",
    },
    {
      href: "/admin/web-search",
      icon: GlobeIcon,
      label: "Web Search",
      segment: "web-search",
    },
  ],
  [
    {
      href: "/admin/users",
      icon: UserIcon,
      label: "Users",
      segment: "users",
    },
    {
      href: "/admin/groups",
      icon: UsersIcon,
      label: "Groups",
      segment: "groups",
    },
    {
      href: "/admin/roles",
      icon: ShieldIcon,
      label: "Roles",
      segment: "roles",
    },
  ],
  [
    {
      href: "/admin/security",
      icon: KeyRoundIcon,
      label: "Security",
      segment: "security",
    },
    {
      href: "/admin/analytics",
      icon: BarChart3Icon,
      label: "Analytics",
      segment: "analytics",
    },
    {
      href: "/admin/billing",
      icon: CreditCardIcon,
      label: "Billing",
      segment: "billing",
    },
  ],
];

const adminNavItems = navSections.flat();

function canAccessNavItem({
  segment,
  isAdmin,
  capabilities,
}: {
  segment: string;
  isAdmin: boolean;
  capabilities: CapabilityId[];
}) {
  if (isAdmin) {
    return true;
  }
  if (segment === "analytics") {
    return (
      hasCapability(capabilities, "admin.audit") ||
      hasCapability(capabilities, "admin.billing")
    );
  }
  const required = ADMIN_NAV_CAPABILITY_BY_SEGMENT[segment];
  if (!required) {
    return false;
  }
  return hasCapability(capabilities, required);
}

function LockedNavItem({ item }: { item: AdminNavItem }) {
  const Icon = item.icon;
  const { isMobile, state } = useSidebar();

  return (
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-full cursor-not-allowed">
            <SidebarMenuButton
              aria-disabled="true"
              className="h-8 cursor-not-allowed text-[14px] text-sidebar-foreground/35 hover:bg-transparent hover:font-normal hover:text-sidebar-foreground/35"
              type="button"
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </SidebarMenuButton>
          </div>
        </TooltipTrigger>
        <TooltipContent
          align="center"
          hidden={state !== "collapsed" || isMobile}
          side="right"
        >
          No access
        </TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  );
}

function AccessibleNavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: AdminNavItem;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
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
        <Link href={item.href} onClick={onNavigate}>
          <Icon className="size-4" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { isAdmin, capabilities } = useTenant();

  const segments = pathname.split("/").filter(Boolean);
  const adminPrefix = "/admin";
  const chatHome = CHAT_HOME;
  const activeSegment = segments.at(1) ?? "";

  return (
    <Sidebar collapsible="icon">
      <CollapsedSidebarExpandSurface>
        <SidebarHeader className="pb-4 pt-3">
          <SidebarBrandHeader
            action={{
              href: chatHome,
              icon: ArrowLeftIcon,
              label: "Back to chat",
            }}
            href={adminPrefix}
            onNavigate={() => setOpenMobile(false)}
            showHeaderCollapse
          />
        </SidebarHeader>

        <SidebarContent className="gap-0">
          <SidebarGroup className="px-2 py-0 pt-4">
            <SidebarGroupContent className="[&_a]:cursor-pointer">
              <SidebarMenu>
                {adminNavItems.map((item) => {
                  const allowed = canAccessNavItem({
                    capabilities,
                    isAdmin,
                    segment: item.segment,
                  });

                  if (!allowed) {
                    return <LockedNavItem item={item} key={item.segment} />;
                  }

                  return (
                    <AccessibleNavItem
                      isActive={activeSegment === item.segment}
                      item={item}
                      key={item.segment}
                      onNavigate={() => setOpenMobile(false)}
                    />
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-0 px-3 pt-2 pb-3 group-data-[collapsible=icon]:hidden">
          <p className="text-[11px] leading-snug text-sidebar-foreground/45">
            © {new Date().getFullYear()} {APP_TITLE} AI
          </p>
        </SidebarFooter>
      </CollapsedSidebarExpandSurface>
    </Sidebar>
  );
}
