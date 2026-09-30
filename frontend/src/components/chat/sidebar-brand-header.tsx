"use client";

import type { LucideIcon } from "lucide-react";
import {
  ChevronsUpDown,
  PanelLeftIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { workspaceLogoSrc } from "@/components/admin/workspace-logo-upload";
import { SidebarAppLogo } from "@/components/chat/sidebar-app-logo";
import { isChatHistoryInfiniteKey } from "@/components/chat/sidebar-history";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useWorkspace } from "@/hooks/use-workspace";
import { chatModelsApiUrl } from "@/lib/ai/chat-models-api";
import { CHAT_HOME } from "@/shared/chat/routes";
import { cn } from "@/shared/utils";

export type SidebarBrandHeaderAction = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const workspaceRadioItemClassName =
  "rounded-lg pr-3 [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden data-[state=checked]:bg-muted/50 data-[state=checked]:text-foreground data-[state=checked]:focus:bg-muted/50 data-[state=checked]:focus:text-foreground data-[state=checked]:[&_svg]:text-foreground";

function SidebarHeaderActionLink({
  action,
  onNavigate,
  className,
}: {
  action: SidebarBrandHeaderAction;
  onNavigate?: () => void;
  className?: string;
}) {
  const Icon = action.icon;

  return (
    <SidebarMenuButton
      asChild
      className={cn(
        "text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground",
        className
      )}
      tooltip={action.label}
    >
      <Link href={action.href} onClick={onNavigate}>
        <Icon className="size-4" />
        <span className="sr-only">{action.label}</span>
      </Link>
    </SidebarMenuButton>
  );
}

function SidebarHeaderIconButton({
  className,
  icon: Icon,
  label,
  onClick,
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <SidebarMenuButton
      className={cn(
        "text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground",
        className
      )}
      onClick={onClick}
      tooltip={label}
      type="button"
    >
      <Icon className="size-4" />
      <span className="sr-only">{label}</span>
    </SidebarMenuButton>
  );
}

function WorkspaceMark({
  slug,
  logoUrl,
}: {
  slug: string | null;
  logoUrl: string | null;
}) {
  if (slug && logoUrl) {
    return (
      <span className="relative flex size-4 shrink-0 items-center justify-center overflow-hidden rounded">
        <Image
          alt=""
          className="size-5! rounded object-cover"
          height={20}
          src={workspaceLogoSrc(slug, logoUrl)}
          unoptimized
          width={20}
        />
      </span>
    );
  }

  return (
    <span className="relative flex size-4 shrink-0 items-center justify-center">
      <SidebarAppLogo className="size-5! shrink-0" />
    </span>
  );
}

export function SidebarBrandHeader({
  adminSettingsHref,
  href,
  onNavigate,
  onAdminNavigate,
  action,
  searchAction,
  showHeaderCollapse = false,
}: {
  adminSettingsHref?: string;
  href?: string;
  onNavigate?: () => void;
  onAdminNavigate?: () => void;
  action?: SidebarBrandHeaderAction;
  searchAction?: { label: string; onClick: () => void };
  /** Admin sidebar only — chat app uses footer collapse for everyone. */
  showHeaderCollapse?: boolean;
}) {
  const router = useRouter();
  const { toggleSidebar, isMobile, state } = useSidebar();
  const { workspace, isLoading, mutate } = useWorkspace();
  const { mutate: mutateCache } = useSWRConfig();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ActionIcon = action?.icon;

  const workspaces = workspace?.workspaces ?? [];
  const activeSlug = workspace?.activeTenantSlug ?? workspace?.slug ?? null;
  const workspaceName =
    workspace?.companyName?.trim() || (isLoading ? "…" : "Workspace");
  const showSwitcher = workspaces.length > 1;

  function switchWorkspace(slug: string) {
    if (slug === activeSlug || pending) {
      return;
    }
    setMenuOpen(false);
    startTransition(() => {
      fetch("/api/workspace", {
        body: JSON.stringify({ slug }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            toast.error("Could not switch workspace");
            return;
          }
          await mutate();
          await Promise.all([
            mutateCache(isChatHistoryInfiniteKey),
            mutateCache(chatModelsApiUrl(slug)),
          ]);
          router.push(CHAT_HOME);
          router.refresh();
          toast.success("Workspace switched");
        })
        .catch(() => {
          toast.error("Could not switch workspace");
        });
    });
  }

  const brandContent = (
    <>
      <WorkspaceMark logoUrl={workspace?.logoUrl ?? null} slug={activeSlug} />
      <span className="min-w-0 flex-1 truncate font-semibold text-[16px] group-data-[collapsible=icon]:hidden">
        {workspaceName}
      </span>
      {showSwitcher ? (
        <ChevronsUpDown className="ml-0.5 size-3.5 shrink-0 opacity-50 group-data-[collapsible=icon]:hidden" />
      ) : null}
    </>
  );

  const brandButtonClassName = cn(
    "h-8 w-full min-w-0 justify-start gap-2 px-2.5 text-sidebar-foreground transition-colors duration-150 hover:text-sidebar-foreground",
    "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2!",
    "group-data-[collapsible=icon]:group-hover/logo:opacity-0"
  );

  const brandControl = showSwitcher ? (
    <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className={brandButtonClassName}
          disabled={pending}
          tooltip={workspaceName}
        >
          {brandContent}
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-52 rounded-lg **:data-[slot=dropdown-menu-radio-item]:cursor-pointer"
        side={isMobile || state === "collapsed" ? "bottom" : "right"}
        sideOffset={8}
      >
        <DropdownMenuRadioGroup
          onValueChange={switchWorkspace}
          value={activeSlug ?? undefined}
        >
          {workspaces.map((item) => (
            <DropdownMenuRadioItem
              className={workspaceRadioItemClassName}
              disabled={pending}
              key={item.id}
              value={item.slug}
            >
              <WorkspaceMark logoUrl={item.logoUrl ?? null} slug={item.slug} />
              <span className="min-w-0 flex-1 truncate">
                {item.companyName}
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <SidebarMenuButton
      asChild={Boolean(href)}
      className={brandButtonClassName}
      tooltip={workspaceName}
    >
      {href ? (
        <Link href={href} onClick={onNavigate}>
          {brandContent}
        </Link>
      ) : (
        <div className="flex items-center gap-2">{brandContent}</div>
      )}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex flex-row items-center gap-1 group-data-[collapsible=icon]:justify-center">
        <div className="group/logo relative flex min-w-0 flex-1 items-center overflow-hidden group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none">
          {brandControl}
          <SidebarMenuButton
            className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:group-hover/logo:opacity-100"
            onClick={() => toggleSidebar()}
            tooltip="Open sidebar"
            type="button"
          >
            <PanelLeftIcon className="size-4" />
            <span className="sr-only">Open sidebar</span>
          </SidebarMenuButton>
        </div>
        <div className="flex shrink-0 items-center gap-0 group-data-[collapsible=icon]:hidden">
          {searchAction ? (
            <SidebarHeaderIconButton
              className="size-8! w-auto!"
              icon={SearchIcon}
              label={searchAction.label}
              onClick={searchAction.onClick}
            />
          ) : null}
          {action ? (
            <SidebarHeaderActionLink
              action={action}
              className="size-8! w-auto!"
              onNavigate={onNavigate}
            />
          ) : null}
          {adminSettingsHref ? (
            <SidebarMenuButton
              asChild
              className="size-8! w-auto! shrink-0 text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground"
              tooltip="Admin settings"
            >
              <Link
                aria-label="Admin settings"
                href={adminSettingsHref}
                onClick={onAdminNavigate}
              >
                <SettingsIcon className="size-4" />
                <span className="sr-only">Admin settings</span>
              </Link>
            </SidebarMenuButton>
          ) : showHeaderCollapse ? (
            <SidebarMenuButton
              className="size-8! w-auto! shrink-0 text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground"
              onClick={() => toggleSidebar()}
              tooltip="Close sidebar"
              type="button"
            >
              <PanelLeftIcon className="size-4" />
              <span className="sr-only">Close sidebar</span>
            </SidebarMenuButton>
          ) : null}
        </div>
      </SidebarMenuItem>
      {searchAction ? (
        <SidebarMenuItem className="mt-1 hidden group-data-[collapsible=icon]:block">
          <SidebarHeaderIconButton
            icon={SearchIcon}
            label={searchAction.label}
            onClick={searchAction.onClick}
          />
        </SidebarMenuItem>
      ) : null}
      {action && ActionIcon ? (
        <SidebarMenuItem className="mt-1 hidden group-data-[collapsible=icon]:block">
          <SidebarHeaderActionLink action={action} onNavigate={onNavigate} />
        </SidebarMenuItem>
      ) : null}
      {adminSettingsHref ? (
        <SidebarMenuItem className="mt-1 hidden group-data-[collapsible=icon]:block">
          <SidebarMenuButton
            asChild
            className="text-sidebar-foreground/60 transition-colors duration-150 hover:text-sidebar-foreground"
            tooltip="Admin settings"
          >
            <Link
              aria-label="Admin settings"
              href={adminSettingsHref}
              onClick={onAdminNavigate}
            >
              <SettingsIcon className="size-4" />
              <span className="sr-only">Admin settings</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ) : null}
    </SidebarMenu>
  );
}
