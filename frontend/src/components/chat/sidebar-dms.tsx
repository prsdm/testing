"use client";

import { Loader2Icon, MessagesSquareIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { GroupDmAvatarStack } from "@/components/chat/group-dm-avatar-stack";
import { SidebarListError } from "@/components/chat/sidebar-list-error";
import { SidebarSectionHeaderIcon } from "@/components/chat/sidebar-section-header-icon";
import { SidebarUnreadBadge } from "@/components/chat/sidebar-unread-badge";
import { UserAvatar } from "@/components/chat/user-avatar";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { DmMemberPickerOption } from "@/contracts/dms";
import {
  createGroupDm,
  createOrOpenDm,
  type DmListResponse,
  type DmPickerResponse,
  dmsListSwrKey,
  dmsPickerSwrKey,
} from "@/lib/dms/dms-api";
import {
  chatConversationPath,
  extractChatIdFromPath,
} from "@/shared/chat/routes";
import { cn, fetcher } from "@/shared/utils";

type NewMessageMode = "direct" | "group";

export function SidebarDirectMessages() {
  const tenantSlug = useTenantSlug();
  const pathname = usePathname();
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const listKey = dmsListSwrKey(tenantSlug);
  const pickerKey = dmsPickerSwrKey(tenantSlug);

  const [createOpen, setCreateOpen] = useState(false);
  const [dmsExpanded, setDmsExpanded] = useState(true);
  const [newMessageMode, setNewMessageMode] =
    useState<NewMessageMode>("direct");
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<
    Set<string>
  >(() => new Set());
  const [isOpening, setIsOpening] = useState(false);
  const activeChatId = extractChatIdFromPath(pathname);

  const {
    data,
    error,
    isLoading,
    mutate: revalidateDms,
  } = useSWR<DmListResponse>(listKey, fetcher, { revalidateOnFocus: true });

  const { data: pickerData } = useSWR<DmPickerResponse>(
    createOpen ? pickerKey : null,
    fetcher
  );

  const dms = data?.dms ?? [];
  const members = pickerData?.members ?? [];

  const selectedGroupCount = selectedGroupMemberIds.size;
  const canCreateGroup = selectedGroupCount >= 2;

  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [members]
  );

  function resetCreateDialog() {
    setNewMessageMode("direct");
    setSelectedGroupMemberIds(new Set());
  }

  function handleCreateOpenChange(open: boolean) {
    setCreateOpen(open);
    if (!open) {
      resetCreateDialog();
    }
  }

  function toggleGroupMember(userId: string) {
    setSelectedGroupMemberIds((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  }

  async function openDmWith(peer: DmMemberPickerOption) {
    if (isOpening) {
      return;
    }
    setIsOpening(true);
    try {
      const dm = await createOrOpenDm(tenantSlug, peer.userId);
      handleCreateOpenChange(false);
      await mutate(listKey);
      setOpenMobile(false);
      router.push(chatConversationPath(dm.id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to open message"
      );
    } finally {
      setIsOpening(false);
    }
  }

  async function createGroupConversation() {
    if (isOpening || !canCreateGroup) {
      return;
    }
    setIsOpening(true);
    try {
      const dm = await createGroupDm(tenantSlug, [...selectedGroupMemberIds]);
      handleCreateOpenChange(false);
      await mutate(listKey);
      setOpenMobile(false);
      router.push(chatConversationPath(dm.id));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create group message"
      );
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem className="cursor-pointer rounded-[0.625rem] hover:bg-sidebar-accent">
              <SidebarMenuButton
                aria-expanded={dmsExpanded}
                aria-label={
                  dmsExpanded
                    ? "Collapse direct messages"
                    : "Expand direct messages"
                }
                className="h-8 text-[14px] text-sidebar-foreground/70 hover:bg-transparent group-hover/menu-item:font-medium group-hover/menu-item:text-sidebar-foreground"
                onClick={() => setDmsExpanded((current) => !current)}
                type="button"
              >
                <SidebarSectionHeaderIcon
                  expanded={dmsExpanded}
                  icon={MessagesSquareIcon}
                />
                <span className="min-w-0 truncate">Direct messages</span>
              </SidebarMenuButton>
              <SidebarMenuAction
                aria-label="New direct message"
                className="right-2 hover:bg-transparent group-hover/menu-item:text-sidebar-foreground"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon />
              </SidebarMenuAction>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
        {dmsExpanded ? (
          <SidebarGroupContent>
            {error && dms.length === 0 ? (
              <SidebarListError
                label="Couldn't load DMs — tap to retry"
                onRetry={() => {
                  void revalidateDms();
                }}
              />
            ) : isLoading && dms.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-1 text-sidebar-foreground/50 text-xs">
                <Loader2Icon className="size-3.5 animate-spin" />
                Loading…
              </div>
            ) : dms.length === 0 ? (
              <button
                className="w-full cursor-pointer px-3 py-1.5 text-left text-[13px] text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                onClick={() => setCreateOpen(true)}
                type="button"
              >
                Message a teammate
              </button>
            ) : (
              <SidebarMenu>
                {dms.map((dm) => {
                  const isActive = activeChatId === dm.id;
                  const hasUnread = dm.unreadCount > 0 && !isActive;
                  const label = dm.title || dm.peerDisplayName;
                  return (
                    <SidebarMenuItem key={dm.id}>
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
                        tooltip={label}
                      >
                        <Link
                          className="gap-2"
                          href={chatConversationPath(dm.id)}
                          onClick={() => setOpenMobile(false)}
                        >
                          {dm.isGroup ? (
                            <GroupDmAvatarStack members={dm.members} />
                          ) : (
                            <UserAvatar
                              className="shrink-0 ring-0"
                              email={dm.peerEmail}
                              image={dm.peerImage}
                              name={dm.peerDisplayName}
                              size="xs"
                              userId={dm.peerUserId}
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            {label}
                          </span>
                          <SidebarUnreadBadge count={dm.unreadCount} />
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

      <Dialog onOpenChange={handleCreateOpenChange} open={createOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New message</DialogTitle>
            <DialogDescription>
              Message one person or start a group with teammates in your
              workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
            <button
              className={cn(
                "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors",
                newMessageMode === "direct"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setNewMessageMode("direct")}
              type="button"
            >
              Direct
            </button>
            <button
              className={cn(
                "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors",
                newMessageMode === "group"
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setNewMessageMode("group")}
              type="button"
            >
              Group
            </button>
          </div>

          {newMessageMode === "direct" ? (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {sortedMembers.length === 0 ? (
                <li className="py-4 text-center text-muted-foreground text-sm">
                  No teammates available
                </li>
              ) : (
                sortedMembers.map((member) => (
                  <li key={member.userId}>
                    <Button
                      className="h-auto w-full justify-start gap-3 px-3 py-2"
                      disabled={isOpening}
                      onClick={() => {
                        openDmWith(member).catch(() => undefined);
                      }}
                      type="button"
                      variant="ghost"
                    >
                      <UserAvatar
                        email={member.email}
                        image={member.image}
                        name={member.displayName}
                        size="sm"
                        userId={member.userId}
                      />
                      <span className="truncate text-left">
                        {member.displayName}
                      </span>
                    </Button>
                  </li>
                ))
              )}
            </ul>
          ) : (
            <>
              <p className="text-muted-foreground text-xs">
                Select at least two people (you&apos;ll be added automatically).
              </p>
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {sortedMembers.length === 0 ? (
                  <li className="py-4 text-center text-muted-foreground text-sm">
                    No teammates available
                  </li>
                ) : (
                  sortedMembers.map((member) => {
                    const checked = selectedGroupMemberIds.has(member.userId);
                    return (
                      <li key={member.userId}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/60">
                          <input
                            checked={checked}
                            className="size-4 shrink-0 rounded border-input"
                            disabled={isOpening}
                            onChange={() => toggleGroupMember(member.userId)}
                            type="checkbox"
                          />
                          <UserAvatar
                            email={member.email}
                            image={member.image}
                            name={member.displayName}
                            size="sm"
                            userId={member.userId}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {member.displayName}
                          </span>
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
              <DialogFooter>
                <Button
                  disabled={!canCreateGroup || isOpening}
                  onClick={() => {
                    createGroupConversation().catch(() => undefined);
                  }}
                  type="button"
                >
                  {isOpening ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    `Create group (${selectedGroupCount} selected)`
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
