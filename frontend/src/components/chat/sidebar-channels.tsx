"use client";

import { HashIcon, Loader2Icon, PlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { SidebarListError } from "@/components/chat/sidebar-list-error";
import { SidebarSectionHeaderIcon } from "@/components/chat/sidebar-section-header-icon";
import { SidebarUnreadBadge } from "@/components/chat/sidebar-unread-badge";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ChannelSummary } from "@/contracts/channels";
import { readChannelApiError } from "@/lib/channels/channel-api";
import {
  channelsApiBase,
  channelsListSwrKey,
} from "@/lib/channels/channels-api";
import {
  chatConversationPath,
  extractChatIdFromPath,
} from "@/shared/chat/routes";
import { cn, fetcher } from "@/shared/utils";

export function SidebarChannels() {
  const tenantSlug = useTenantSlug();
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const listKey = channelsListSwrKey(tenantSlug);

  const [createOpen, setCreateOpen] = useState(false);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [nameDraft, setNameDraft] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const activeChatId = extractChatIdFromPath(pathname);

  const {
    data,
    error,
    isLoading,
    mutate: revalidateChannels,
  } = useSWR<{
    channels: ChannelSummary[];
  }>(listKey, fetcher, { revalidateOnFocus: true });

  const channels = data?.channels ?? [];

  async function handleCreateChannel() {
    const name = nameDraft.trim();
    if (!name || isCreating) {
      return;
    }
    setIsCreating(true);
    try {
      const response = await fetch(channelsApiBase(tenantSlug), {
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(
          await readChannelApiError(response, "Failed to create channel")
        );
      }
      const payload = (await response.json()) as { channel: ChannelSummary };
      setCreateOpen(false);
      setNameDraft("");
      await mutate(listKey);
      setOpenMobile(false);
      router.push(chatConversationPath(payload.channel.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create channel"
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem className="cursor-pointer rounded-[0.625rem] hover:bg-sidebar-accent">
              <SidebarMenuButton
                aria-expanded={channelsExpanded}
                aria-label={
                  channelsExpanded ? "Collapse channels" : "Expand channels"
                }
                className="h-8 text-[14px] text-sidebar-foreground/70 hover:bg-transparent group-hover/menu-item:font-medium group-hover/menu-item:text-sidebar-foreground"
                onClick={() => setChannelsExpanded((current) => !current)}
                type="button"
              >
                <SidebarSectionHeaderIcon
                  expanded={channelsExpanded}
                  icon={UsersIcon}
                />
                <span className="min-w-0 truncate">Channels</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                aria-label="Create channel"
                className="right-2 hover:bg-transparent group-hover/menu-item:text-sidebar-foreground"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon />
              </SidebarMenuAction>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
        {channelsExpanded ? (
          <SidebarGroupContent>
            {error && channels.length === 0 ? (
              <SidebarListError
                label="Couldn't load channels — tap to retry"
                onRetry={() => {
                  void revalidateChannels();
                }}
              />
            ) : isLoading && channels.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-1 text-sidebar-foreground/50 text-xs">
                <Loader2Icon className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : channels.length === 0 ? (
              <button
                className="w-full cursor-pointer px-3 py-1.5 text-left text-[13px] text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                onClick={() => setCreateOpen(true)}
                type="button"
              >
                Create a channel
              </button>
            ) : (
              <SidebarMenu>
                {channels.map((channel) => {
                  const isActive = activeChatId === channel.id;
                  const hasUnread = channel.unreadCount > 0 && !isActive;
                  return (
                    <SidebarMenuItem key={channel.id}>
                      <SidebarMenuButton
                        asChild
                        className={cn(
                          "h-8 text-[14px]",
                          isActive
                            ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                            : hasUnread
                              ? "font-semibold text-sidebar-foreground hover:bg-sidebar-accent"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        )}
                        isActive={isActive}
                        tooltip={`#${channel.title}`}
                      >
                        <Link
                          className="gap-2"
                          href={chatConversationPath(channel.id)}
                          onClick={() => setOpenMobile(false)}
                        >
                          <HashIcon className="size-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">
                            {channel.title}
                          </span>
                          <SidebarUnreadBadge count={channel.unreadCount} />
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        ) : null}
      </SidebarGroup>

      <Dialog
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setNameDraft("");
          }
        }}
        open={createOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>
              Workspace members only. Add people after you create the channel.
            </DialogDescription>
          </DialogHeader>
          <Input
            onChange={(event) => setNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleCreateChannel().catch(() => undefined);
              }
            }}
            placeholder="e.g. engineering"
            value={nameDraft}
          />
          <Button
            disabled={isCreating || !nameDraft.trim()}
            onClick={() => {
              handleCreateChannel().catch(() => undefined);
            }}
            type="button"
          >
            {isCreating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : null}
            Create channel
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
