"use client";

import {
  BookTextIcon,
  FolderOpenIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import type { RefObject } from "react";
import { useRef, useState } from "react";
import { DmConversationDetailsDialog } from "@/components/channels/dm-conversation-details-dialog";
import { RoomWorkspaceTab } from "@/components/channels/room-workspace-tab";
import { GroupDmAvatarStack } from "@/components/chat/group-dm-avatar-stack";
import {
  RoomConversationSearchControl,
  useRoomConversationSearch,
} from "@/components/chat/room-conversation-search";
import { clampThreadChannelPaneWidth } from "@/components/chat/thread-split-resize-handle";
import { UserAvatar } from "@/components/chat/user-avatar";
import type { DmMemberSummary } from "@/contracts/dms";
import type { RoomMessageSearchHit } from "@/contracts/room-message-search";
import { cn } from "@/shared/utils";

const workspaceHeaderPaddingClassName = "px-4 md:px-6";

export type DmWorkspaceView = "messages" | "kb" | "library";

export type DmWorkspaceHeaderProps = {
  chatId: string;
  title: string;
  isGroup: boolean;
  peerDisplayName?: string | null;
  peerEmail?: string | null;
  peerImage?: string | null;
  peerUserId?: string | null;
  members?: DmMemberSummary[];
  view: DmWorkspaceView;
  onViewChange: (view: DmWorkspaceView) => void;
  conversationSearch?: {
    chatId: string;
    onSelectHit: (hit: RoomMessageSearchHit) => void;
  };
  /** Narrow left pane when a thread is open */
  compact?: boolean;
  /** Omit outer sticky shell (split header left cell) */
  embedded?: boolean;
};

export function DmWorkspaceHeader({
  chatId,
  title,
  isGroup,
  peerDisplayName,
  peerEmail,
  peerImage,
  peerUserId,
  members = [],
  view,
  onViewChange,
  conversationSearch,
  compact = false,
  embedded = false,
}: DmWorkspaceHeaderProps) {
  const searchRootRef = useRef<HTMLElement>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const hasSearch = Boolean(conversationSearch);

  const search = useRoomConversationSearch({
    chatId: conversationSearch?.chatId ?? "",
    enabled: hasSearch,
    rootRef: searchRootRef,
  });

  function handleSelectHit(hit: RoomMessageSearchHit) {
    conversationSearch?.onSelectHit(hit);
    search.clearSearch();
  }

  const showSearchField = hasSearch;

  const identity = (
    <button
      className={cn(
        "flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left font-semibold text-[16px] text-foreground leading-snug transition-colors hover:bg-muted/70",
        compact
          ? "max-w-[8rem] sm:max-w-[10rem]"
          : "max-w-[12rem] sm:max-w-[14rem]"
      )}
      onClick={() => onViewChange("messages")}
      type="button"
    >
      {isGroup ? (
        <GroupDmAvatarStack className="h-5 w-9 shrink-0" members={members} />
      ) : (
        <UserAvatar
          className="shrink-0 ring-0"
          email={peerEmail ?? undefined}
          image={peerImage ?? null}
          name={peerDisplayName ?? title}
          size="sm"
          userId={peerUserId ?? undefined}
        />
      )}
      <span className="min-w-0 truncate">{title}</span>
    </button>
  );

  const bar = (
    <div
      className={cn(
        "h-14 min-w-0 items-center gap-2 md:gap-3",
        compact ? "flex" : "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
        embedded ? "px-3 md:px-4" : workspaceHeaderPaddingClassName
      )}
    >
      <div className={cn(compact ? undefined : "justify-self-start")}>
        {identity}
      </div>

      {compact ? (
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
      ) : (
        <div className="flex min-w-0 items-center justify-center justify-self-center">
          {showSearchField ? (
            <RoomConversationSearchControl
              className="w-72 sm:w-80 md:w-96 lg:w-[28rem]"
              onSelectHit={handleSelectHit}
              search={search}
            />
          ) : null}
        </div>
      )}

      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5",
          compact ? undefined : "justify-self-end"
        )}
      >
        <nav
          aria-label="Conversation views"
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
          aria-label={
            isGroup ? "Conversation settings" : "Direct message settings"
          }
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          onClick={() => setDetailsOpen(true)}
          type="button"
        >
          <SettingsIcon aria-hidden className="size-4 shrink-0" />
        </button>
      </div>
    </div>
  );

  const detailsDialog = (
    <DmConversationDetailsDialog
      chatId={chatId}
      email={peerEmail}
      image={peerImage}
      isGroup={isGroup}
      members={members}
      name={title}
      onOpenChange={setDetailsOpen}
      open={detailsOpen}
      userId={peerUserId}
    />
  );

  if (embedded) {
    return (
      <>
        <div
          className="w-full min-w-0"
          ref={searchRootRef as RefObject<HTMLDivElement>}
        >
          {bar}
        </div>
        {detailsDialog}
      </>
    );
  }

  return (
    <>
      <header
        className="relative sticky top-0 z-20 shrink-0 overflow-visible border-border/60 border-b bg-background/95 backdrop-blur-sm"
        ref={searchRootRef}
      >
        {bar}
      </header>
      {detailsDialog}
    </>
  );
}

export function DmThreadSplitHeader({
  channelPaneWidthPercent,
  threadReplyCount,
  onCloseThread,
  ...dmProps
}: DmWorkspaceHeaderProps & {
  channelPaneWidthPercent: number;
  threadReplyCount: number;
  onCloseThread: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 flex h-14 shrink-0 gap-px overflow-visible bg-border/60 backdrop-blur-sm">
      <div
        className="flex min-w-0 shrink-0 overflow-visible border-border/60 border-b bg-background/95"
        style={{
          width: `${clampThreadChannelPaneWidth(channelPaneWidthPercent)}%`,
        }}
      >
        <DmWorkspaceHeader {...dmProps} compact embedded />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2 bg-background/95 px-4 md:px-5">
        <div className="min-w-0 truncate">
          <span className="font-semibold text-[15px] text-foreground">
            Thread
          </span>
          <span className="ml-2 text-muted-foreground text-sm">
            {threadReplyCount} {threadReplyCount === 1 ? "reply" : "replies"}
          </span>
        </div>
        <button
          aria-label="Close thread"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          onClick={onCloseThread}
          type="button"
        >
          <XIcon className="size-6 stroke-2" />
        </button>
      </div>
    </div>
  );
}
