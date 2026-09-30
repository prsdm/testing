"use client";

import { MessageSquareIcon, PlusIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { SidebarSectionHeaderIcon } from "@/components/chat/sidebar-section-header-icon";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ChatHistory } from "@/contracts/chat";
import {
  useActiveChatId,
  useBeginNewChat,
  useStreamingChatIds,
} from "@/hooks/use-active-chat";
import { useWorkspace } from "@/hooks/use-workspace";
import { channelsListSwrKey } from "@/lib/channels/channels-api";
import {
  prependChatToHistoryPages,
  registerChatHistorySync,
  updateChatTitleInHistoryPages,
} from "@/lib/chat/history-sync";
import { dmsListSwrKey } from "@/lib/dms/dms-api";
import type { SessionUser } from "@/shared/auth/types";
import {
  CHAT_HOME,
  chatConversationPath,
  extractChatIdFromPath,
  isChatAreaPath,
} from "@/shared/chat/routes";
import { fetcher } from "@/shared/utils";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";

export type { ChatHistory } from "@/contracts/chat";

function ChatsSectionHeader({
  expanded,
  onNewChat,
  onToggle,
}: {
  expanded: boolean;
  onNewChat: () => void;
  onToggle: () => void;
}) {
  return (
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem className="cursor-pointer rounded-[0.625rem] hover:bg-sidebar-accent">
          <SidebarMenuButton
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse chats" : "Expand chats"}
            className="h-8 text-[14px] text-sidebar-foreground/70 hover:bg-transparent group-hover/menu-item:font-medium group-hover/menu-item:text-sidebar-foreground"
            onClick={onToggle}
            type="button"
          >
            <SidebarSectionHeaderIcon
              expanded={expanded}
              icon={MessageSquareIcon}
            />
            <span className="min-w-0 truncate">Chats</span>
          </SidebarMenuButton>
          <SidebarMenuAction
            aria-label="New chat"
            className="right-2 hover:bg-transparent group-hover/menu-item:text-sidebar-foreground"
            onClick={onNewChat}
          >
            <PlusIcon />
          </SidebarMenuAction>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  );
}

const PAGE_SIZE = 20;

export { PAGE_SIZE };

/** First infinite-scroll page key for a workspace history cache. */
export function getChatHistoryFirstPageKey(workspaceSlug: string) {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/history?limit=${PAGE_SIZE}&workspace=${encodeURIComponent(workspaceSlug)}`;
}

/** Scope history cache by workspace so switching tenants does not reuse another workspace's recents. */
export function createChatHistoryPaginationKey(workspaceSlug: string) {
  return (pageIndex: number, previousPageData: ChatHistory) => {
    if (previousPageData && previousPageData.hasMore === false) {
      return null;
    }

    const scope = `&workspace=${encodeURIComponent(workspaceSlug)}`;

    if (pageIndex === 0) {
      return getChatHistoryFirstPageKey(workspaceSlug);
    }

    const firstChatFromPage = previousPageData.chats.at(-1);

    if (!firstChatFromPage) {
      return null;
    }

    return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}${scope}`;
  };
}

export function isChatHistoryInfiniteKey(key: unknown): boolean {
  return typeof key === "string" && key.includes("/api/history");
}

export function SidebarHistory({ user }: { user: SessionUser | undefined }) {
  const { setOpenMobile } = useSidebar();
  const beginNewChat = useBeginNewChat();
  const pathname = usePathname();
  const pathnameChatId = extractChatIdFromPath(pathname);
  const composerChatId = useActiveChatId();
  const activeChatId =
    pathnameChatId ?? (isChatAreaPath(pathname) ? composerChatId : null);
  const streamingChatIds = useStreamingChatIds();
  const tenantSlug = useTenantSlug();
  const { workspace } = useWorkspace();
  const workspaceSlug =
    tenantSlug || workspace?.activeTenantSlug || workspace?.slug || null;

  const { data: channelsData } = useSWR<{ channels: { id: string }[] }>(
    workspaceSlug ? channelsListSwrKey(workspaceSlug) : null,
    fetcher
  );
  const { data: dmsData } = useSWR<{ dms: { id: string }[] }>(
    workspaceSlug ? dmsListSwrKey(workspaceSlug) : null,
    fetcher
  );
  const sidebarExcludedChatIds = useMemo(() => {
    const ids = new Set<string>();
    for (const channel of channelsData?.channels ?? []) {
      ids.add(channel.id);
    }
    for (const dm of dmsData?.dms ?? []) {
      ids.add(dm.id);
    }
    return ids;
  }, [channelsData?.channels, dmsData?.dms]);

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(
    user && workspaceSlug
      ? createChatHistoryPaginationKey(workspaceSlug)
      : () => null,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!user || !workspaceSlug) {
      return;
    }
    return registerChatHistorySync({
      prepend: (entry) => {
        mutate((pages) => prependChatToHistoryPages(pages, entry), {
          revalidate: false,
        }).catch(() => undefined);
      },
      updateTitle: (chatId, title) => {
        mutate((pages) => updateChatTitleInHistoryPages(pages, chatId, title), {
          revalidate: false,
        }).catch(() => undefined);
      },
    });
  }, [mutate, user, workspaceSlug]);

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [chatsExpanded, setChatsExpanded] = useState(true);

  function handleStartNewChat() {
    setOpenMobile(false);
    beginNewChat();
  }

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory =
    !paginatedChatHistories ||
    paginatedChatHistories.length === 0 ||
    paginatedChatHistories.every((page) => page.chats.length === 0);

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // History scrolls inside SidebarContent, not the window. Also re-check after
  // each page finishes — if the sentinel stays visible, onViewportEnter alone
  // never fires again and loading gets stuck.
  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || hasReachedEnd) {
      return;
    }

    const scrollRoot = node.closest('[data-sidebar="content"]');
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !entries.some((entry) => entry.isIntersecting) ||
          isValidating ||
          hasReachedEnd
        ) {
          return;
        }
        setSize((size) => size + 1);
      },
      {
        root: scrollRoot instanceof Element ? scrollRoot : null,
        rootMargin: "120px",
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasReachedEnd, isValidating, setSize]);

  const handleDelete = async () => {
    const chatToDelete = deleteId;
    if (!chatToDelete) {
      setShowDeleteDialog(false);
      return;
    }

    const isCurrentChat = pathname === chatConversationPath(chatToDelete);

    setShowDeleteDialog(false);

    if (isCurrentChat) {
      router.replace(CHAT_HOME);
    }

    mutate(
      (chatHistories) => {
        if (!chatHistories) {
          return chatHistories;
        }
        return chatHistories.map((chatHistory) => ({
          ...chatHistory,
          chats: chatHistory.chats.filter((chat) => chat.id !== chatToDelete),
        }));
      },
      { revalidate: false }
    );

    try {
      const response = await fetch(
        `${process.env.KIMIRO_BASE_PATH ?? ""}/api/chat?id=${chatToDelete}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }
      toast.success("Chat deleted");
    } catch {
      toast.error("Could not delete chat");
    } finally {
      await mutate();
    }
  };

  const handleRename = async ({
    chatId,
    title,
  }: {
    chatId: string;
    title: string;
  }) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Chat name is required.");
      throw new Error("Chat name is required.");
    }

    mutate(
      (chatHistories) => {
        if (!chatHistories) {
          return chatHistories;
        }
        return chatHistories.map((chatHistory) => ({
          ...chatHistory,
          chats: chatHistory.chats.map((item) =>
            item.id === chatId ? { ...item, title: trimmedTitle } : item
          ),
        }));
      },
      { revalidate: false }
    );

    try {
      const response = await fetch(
        `${process.env.KIMIRO_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
        {
          body: JSON.stringify({ title: trimmedTitle }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to rename chat");
      }
      toast.success("Chat renamed");
    } catch {
      toast.error("Could not rename chat");
      await mutate();
      throw new Error("Failed to rename chat");
    }
  };

  if (!user) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[14px] text-sidebar-foreground/60">
            Login to save and revisit previous chats!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading && !paginatedChatHistories) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <ChatsSectionHeader
          expanded={chatsExpanded}
          onNewChat={handleStartNewChat}
          onToggle={() => setChatsExpanded((current) => !current)}
        />
        {chatsExpanded ? (
          <SidebarGroupContent>
            <div className="flex flex-col gap-0.5 px-1">
              {[44, 32, 28, 64, 52].map((item) => (
                <div
                  className="flex h-8 items-center gap-2 rounded-lg px-2"
                  key={item}
                >
                  <div
                    className="h-3 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-foreground/6"
                    style={
                      {
                        "--skeleton-width": `${item}%`,
                      } as React.CSSProperties
                    }
                  />
                </div>
              ))}
            </div>
          </SidebarGroupContent>
        ) : null}
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <ChatsSectionHeader
          expanded={chatsExpanded}
          onNewChat={handleStartNewChat}
          onToggle={() => setChatsExpanded((current) => !current)}
        />
        {chatsExpanded ? (
          <SidebarGroupContent>
            <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[14px] text-sidebar-foreground/60">
              Your conversations will appear here once you start chatting!
            </div>
          </SidebarGroupContent>
        ) : null}
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <ChatsSectionHeader
          expanded={chatsExpanded}
          onNewChat={handleStartNewChat}
          onToggle={() => setChatsExpanded((current) => !current)}
        />
        {chatsExpanded ? (
          <SidebarGroupContent>
            <SidebarMenu>
              {paginatedChatHistories?.flatMap((page) =>
                page.chats
                  .filter((chat) => !sidebarExcludedChatIds.has(chat.id))
                  .map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      isStreaming={streamingChatIds.has(chat.id)}
                      key={chat.id}
                      onDelete={(chatId) => {
                        setDeleteId(chatId);
                        setShowDeleteDialog(true);
                      }}
                      onRename={handleRename}
                      setOpenMobile={setOpenMobile}
                    />
                  ))
              )}
            </SidebarMenu>

            <div aria-hidden className="h-px w-full" ref={loadMoreRef} />

            {hasReachedEnd ? null : (
              <div className="mt-1 flex flex-row items-center gap-2 px-4 py-2 text-sidebar-foreground/50">
                {isValidating ? (
                  <>
                    <div className="animate-spin">
                      <LoaderIcon />
                    </div>
                    <div className="text-[14px]">Loading...</div>
                  </>
                ) : (
                  <div className="text-[14px]">Scroll for more</div>
                )}
              </div>
            )}
          </SidebarGroupContent>
        ) : null}
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              chat and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
