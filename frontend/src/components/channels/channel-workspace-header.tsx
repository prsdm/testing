"use client";

import {
  BookTextIcon,
  FolderOpenIcon,
  HashIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import useSWR from "swr";
import { ChannelDetailsDialog } from "@/components/channels/channel-details-dialog";
import { ChannelThreadTagCatalogControl } from "@/components/channels/channel-thread-tag-catalog";
import { RoomWorkspaceTab } from "@/components/channels/room-workspace-tab";
import {
  RoomConversationSearchControl,
  useRoomConversationSearch,
} from "@/components/chat/room-conversation-search";
import { UserAvatar } from "@/components/chat/user-avatar";
import { useTenantSlug } from "@/components/providers/tenant-provider";
import { channelTopicAvatarClassName } from "@/components/workspace/workspace-page-layout";
import type { ChannelMember } from "@/contracts/channels";
import type { RoomMessageSearchHit } from "@/contracts/room-message-search";
import { channelMembersApiUrl } from "@/lib/channels/channel-api";
import { cn, fetcher } from "@/shared/utils";

const workspaceHeaderPaddingClassName = "px-4 md:px-6";

export type ChannelWorkspaceView = "messages" | "kb" | "library";

export type ChannelWorkspaceHeaderProps = {
  channelId: string;
  channelTitle: string;
  view: ChannelWorkspaceView;
  onViewChange: (view: ChannelWorkspaceView) => void;
  conversationSearch?: {
    chatId: string;
    onSelectHit: (hit: RoomMessageSearchHit) => void;
  };
  /** Narrow left pane when a thread is open */
  compact?: boolean;
  /** Omit outer sticky shell (split header left cell) */
  embedded?: boolean;
  isReadonly?: boolean;
};

export function ChannelWorkspaceHeader({
  channelId,
  channelTitle,
  view,
  onViewChange,
  conversationSearch,
  compact = false,
  embedded = false,
  isReadonly = false,
}: ChannelWorkspaceHeaderProps) {
  const tenantSlug = useTenantSlug();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<"about" | "members">("about");
  const searchRootRef = useRef<HTMLElement>(null);

  const hasSearch = Boolean(conversationSearch);

  const search = useRoomConversationSearch({
    chatId: conversationSearch?.chatId ?? "",
    enabled: hasSearch,
    rootRef: searchRootRef,
  });

  const membersKey = channelMembersApiUrl(tenantSlug, channelId);

  const { data: membersData, mutate: mutateMembers } = useSWR<{
    members: ChannelMember[];
  }>(membersKey, fetcher, { revalidateOnFocus: true });

  const members = membersData?.members ?? [];
  const memberCount = members.length;

  function openChannelDetails(tab: "about" | "members") {
    setDetailsTab(tab);
    setDetailsOpen(true);
  }

  function handleSelectHit(hit: RoomMessageSearchHit) {
    conversationSearch?.onSelectHit(hit);
    search.clearSearch();
  }

  const showSearchField = hasSearch;
  const inboxSearchLayout = compact && embedded && showSearchField;

  const titleAndActions = (
    <>
      <div
        className={cn(
          "min-w-0 shrink-0",
          compact && !inboxSearchLayout ? undefined : "justify-self-start",
          inboxSearchLayout ? "min-w-0 flex-1" : undefined
        )}
      >
        <button
          className={cn(
            "flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-left font-semibold text-foreground leading-snug transition-colors hover:bg-muted/70",
            inboxSearchLayout
              ? "text-[15px]"
              : cn(
                  "text-[16px]",
                  compact
                    ? "max-w-[7rem] sm:max-w-[9rem]"
                    : "max-w-[11rem] sm:max-w-[13rem]"
                )
          )}
          onClick={() => onViewChange("messages")}
          type="button"
        >
          <HashIcon aria-hidden className="size-4 shrink-0 stroke-[2.5]" />
          <span className="min-w-0 truncate">{channelTitle}</span>
        </button>
      </div>

      {!inboxSearchLayout && compact ? (
        showSearchField ? (
          <RoomConversationSearchControl
            className="min-w-[3.5rem] max-w-full flex-1"
            dense
            onSelectHit={handleSelectHit}
            placeholder="Search"
            search={search}
          />
        ) : (
          <div aria-hidden className="min-w-0 flex-1" />
        )
      ) : null}

      {!inboxSearchLayout && !compact ? (
        <div className="flex min-w-0 items-center justify-center justify-self-center">
          {showSearchField ? (
            <RoomConversationSearchControl
              className="w-72 sm:w-80 md:w-96 lg:w-[28rem]"
              onSelectHit={handleSelectHit}
              search={search}
            />
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex shrink-0 items-center gap-1.5",
          compact && !inboxSearchLayout ? undefined : "justify-self-end"
        )}
      >
        {view === "messages" ? (
          <ChannelThreadTagCatalogControl
            channelId={channelId}
            isReadonly={isReadonly}
          />
        ) : null}
        {memberCount > 0 ? (
          <button
            aria-label={`${memberCount} channel members`}
            className="flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            onClick={() => openChannelDetails("members")}
            type="button"
          >
            <UsersIcon aria-hidden className="size-4 shrink-0" />
            <span className="font-medium text-[13px] tabular-nums">
              {memberCount}
            </span>
          </button>
        ) : null}
        <nav
          aria-label="Channel views"
          className="flex shrink-0 items-center gap-0.5"
        >
          <RoomWorkspaceTab
            active={view === "kb"}
            icon={BookTextIcon}
            label="Knowledge base"
            onClick={() => onViewChange("kb")}
          />
          <RoomWorkspaceTab
            active={view === "library"}
            icon={FolderOpenIcon}
            label="Library"
            onClick={() => onViewChange("library")}
          />
        </nav>
        <button
          aria-label="Channel settings"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={() => openChannelDetails("about")}
          type="button"
        >
          <SettingsIcon aria-hidden className="size-4 shrink-0" />
        </button>
      </div>
    </>
  );

  const bar = inboxSearchLayout ? (
    <div className="flex w-full min-w-0 flex-col">
      <div className="flex h-14 min-w-0 items-center gap-2 border-border/60 border-b px-3 md:px-4">
        {titleAndActions}
      </div>
      <div className="px-3 py-2.5 md:px-4">
        <RoomConversationSearchControl
          inbox
          onSelectHit={handleSelectHit}
          placeholder="Search"
          search={search}
        />
      </div>
    </div>
  ) : (
    <div
      className={cn(
        "h-14 min-w-0 items-center gap-2 md:gap-3",
        compact ? "flex" : "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
        embedded ? "px-3 md:px-4" : workspaceHeaderPaddingClassName
      )}
    >
      {titleAndActions}
    </div>
  );

  const dialog = tenantSlug ? (
    <ChannelDetailsDialog
      channelId={channelId}
      channelTitle={channelTitle}
      initialTab={detailsTab}
      onMembersChanged={() => {
        mutateMembers().catch(() => undefined);
      }}
      onOpenChange={setDetailsOpen}
      open={detailsOpen}
      tenantSlug={tenantSlug}
    />
  ) : null;

  if (embedded) {
    return (
      <>
        <div
          className="w-full min-w-0"
          ref={searchRootRef as RefObject<HTMLDivElement>}
        >
          {bar}
        </div>
        {dialog}
      </>
    );
  }

  return (
    <header
      className="sticky top-0 z-20 shrink-0 overflow-visible border-border/60 border-b bg-background/95 backdrop-blur-sm"
      ref={searchRootRef}
    >
      {bar}
      {dialog}
    </header>
  );
}

export type ChannelThreadSplitHeaderMeta = {
  authorEmail?: string | null;
  authorImage?: string | null;
  authorName: string;
  authorUserId?: string | null;
  title: string;
};

/** Thread pane title bar (right column only — not coupled to inbox search height). */
export function ChannelThreadPaneHeader({
  threadMeta,
}: {
  threadMeta: ChannelThreadSplitHeaderMeta;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center gap-3 border-border/60 border-b bg-background/95 px-4 md:px-5">
      <h1 className="min-w-0 flex-1 truncate font-medium text-[15px] text-foreground leading-none tracking-tight">
        {threadMeta.title}
      </h1>
      <div className="flex max-w-[min(100%,12rem)] shrink-0 items-center gap-2 sm:max-w-[14rem]">
        <p className="min-w-0 truncate text-[12px] text-muted-foreground leading-tight sm:text-[13px]">
          <span className="text-muted-foreground">Created by </span>
          <span className="font-medium text-foreground">
            {threadMeta.authorName}
          </span>
        </p>
        <UserAvatar
          className={cn(channelTopicAvatarClassName, "ring-0")}
          email={threadMeta.authorEmail}
          image={threadMeta.authorImage}
          name={threadMeta.authorName}
          size="xs"
          userId={threadMeta.authorUserId}
        />
      </div>
    </div>
  );
}
