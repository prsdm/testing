"use client";

import {
  BookTextIcon,
  FolderKanbanIcon,
  FolderOpenIcon,
  LayoutGridIcon,
  Loader2Icon,
  PenSquareIcon,
  SearchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ChatHistory } from "@/contracts/chat";
import { useBeginNewChat } from "@/hooks/use-active-chat";
import { useWorkspace } from "@/hooks/use-workspace";
import { chatConversationPath } from "@/shared/chat/routes";
import { cn, fetcher } from "@/shared/utils";

type QuickAction = {
  id: string;
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  onSelect?: () => void;
};

const actionButtonClassName =
  "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50";

const scrollAreaClassName =
  "no-scrollbar max-h-60 overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

export function ChatSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const beginNewChat = useBeginNewChat();
  const tenantSlug = useTenantSlug();
  const { workspace } = useWorkspace();
  const workspaceSlug =
    tenantSlug || workspace?.activeTenantSlug || workspace?.slug || null;

  const historyLimit = query.trim() ? 15 : 8;

  const historyKey =
    open && workspaceSlug
      ? query.trim()
        ? `${process.env.KIMIRO_BASE_PATH ?? ""}/api/history?limit=${historyLimit}&workspace=${encodeURIComponent(workspaceSlug)}&q=${encodeURIComponent(query.trim())}`
        : `${process.env.KIMIRO_BASE_PATH ?? ""}/api/history?limit=${historyLimit}&workspace=${encodeURIComponent(workspaceSlug)}`
      : null;

  const { data, isLoading } = useSWR<ChatHistory>(historyKey, fetcher, {
    revalidateOnFocus: false,
  });

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        href: "/",
        icon: PenSquareIcon,
        id: "new-chat",
        label: "New chat",
        onSelect: () => beginNewChat(),
        shortcut: "⌘N",
      },
      {
        href: "/connectors",
        icon: LayoutGridIcon,
        id: "connectors",
        label: "Connectors",
      },
      {
        href: "/knowledge-bases",
        icon: FolderKanbanIcon,
        id: "knowledge-bases",
        label: "Knowledge base",
      },
      {
        href: "/library",
        icon: FolderOpenIcon,
        id: "library",
        label: "Library",
      },
      {
        href: "/sources",
        icon: BookTextIcon,
        id: "sources",
        label: "Sources",
      },
    ],
    [beginNewChat]
  );

  const chats = data?.chats ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredQuickActions =
    normalizedQuery.length === 0
      ? quickActions
      : quickActions.filter((action) =>
          action.label.toLowerCase().includes(normalizedQuery)
        );

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function closeAndNavigate(path: string) {
    onOpenChange(false);
    setQuery("");
    router.push(path);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setQuery("");
    }
  }

  function runQuickAction(action: QuickAction) {
    if (action.onSelect) {
      onOpenChange(false);
      setQuery("");
      action.onSelect();
      if (action.href) {
        router.push(action.href);
      }
      return;
    }
    if (action.href) {
      closeAndNavigate(action.href);
    }
  }

  const showEmpty =
    !isLoading &&
    chats.length === 0 &&
    filteredQuickActions.length === 0 &&
    normalizedQuery.length > 0;

  function renderQuickActions() {
    if (filteredQuickActions.length === 0) {
      return null;
    }
    return (
      <section className="flex flex-col gap-1">
        <h3 className="px-3 font-medium text-[13px] text-muted-foreground">
          Quick actions
        </h3>
        <ul className="flex flex-col gap-0.5">
          {filteredQuickActions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.id}>
                <button
                  className={actionButtonClassName}
                  onClick={() => runQuickAction(action)}
                  type="button"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span>{action.label}</span>
                  {action.shortcut ? (
                    <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                      {action.shortcut}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  function renderChats() {
    if (chats.length === 0 && isLoading) {
      return (
        <div className="flex items-center gap-2 px-3 py-4 text-muted-foreground text-sm">
          <Loader2Icon className="size-4 animate-spin" />
          Loading chats…
        </div>
      );
    }
    if (chats.length === 0) {
      return null;
    }
    return (
      <section className="flex flex-col gap-1">
        <h3 className="px-3 font-medium text-[13px] text-muted-foreground">
          {normalizedQuery.length > 0 ? "Chats" : "Recent chats"}
        </h3>
        <ul className="flex flex-col gap-0.5">
          {chats.map((chat) => (
            <li key={chat.id}>
              <button
                className={cn(actionButtonClassName, "gap-2")}
                onClick={() => closeAndNavigate(chatConversationPath(chat.id))}
                type="button"
              >
                <span className="truncate">
                  {chat.title || "Untitled chat"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-lg p-0 sm:max-w-lg [&_button]:cursor-pointer"
        onOpenAutoFocus={(event) => event.preventDefault()}
        overlayClassName="bg-black/45 supports-backdrop-filter:backdrop-blur-none"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search chats</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-5 pt-4 pb-4">
          <div className="relative shrink-0">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-lg pl-9"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats…"
              ref={inputRef}
              value={query}
            />
          </div>

          {showEmpty ? (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">
              No matching chats or actions.
            </p>
          ) : (
            <div className={cn(scrollAreaClassName, "flex flex-col gap-3")}>
              {normalizedQuery.length > 0 ? (
                <>
                  {renderChats()}
                  {renderQuickActions()}
                </>
              ) : (
                <>
                  {renderQuickActions()}
                  {renderChats()}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
