"use client";

import { format, formatDistanceToNowStrict, isToday } from "date-fns";
import { MESSAGE_HEADER_TILE_CLASS } from "@/components/chat/kimiro-icon";
import { KimiroLogoTile } from "@/components/chat/sidebar-app-logo";
import { UserAvatar } from "@/components/chat/user-avatar";
import { channelTopicThreadReplyAvatarClassName } from "@/components/workspace/workspace-page-layout";
import type { ThreadSummary } from "@/lib/chat/thread-summary";
import { CHAT_THREAD_REPLY_LINK_CLASS } from "@/shared/chat/mention-styles";
import { cn } from "@/shared/utils";

function formatThreadLastReply(createdAt?: string): string | null {
  if (!createdAt) {
    return null;
  }
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

function ThreadParticipantStack({
  channelCard = false,
  participants,
}: {
  channelCard?: boolean;
  participants: ThreadSummary["participants"];
}) {
  if (participants.length === 0) {
    return null;
  }

  const visible = channelCard ? participants.slice(0, 2) : participants;

  const participantTileClass = channelCard
    ? cn(channelTopicThreadReplyAvatarClassName, "ring-0 shadow-none")
    : cn(MESSAGE_HEADER_TILE_CLASS, "ring-0 shadow-none");

  return (
    <span className="flex shrink-0 items-center">
      {visible.map((participant, index) => (
        <span
          className={cn(
            "relative inline-flex",
            index > 0 && (channelCard ? "-ml-1" : "-ml-1.5")
          )}
          key={
            participant.kind === "kimiro"
              ? "kimiro"
              : `${participant.kind}-${participant.email ?? participant.name}`
          }
          style={{ zIndex: index }}
        >
          {participant.kind === "kimiro" ? (
            <KimiroLogoTile className={participantTileClass} />
          ) : (
            <UserAvatar
              className={participantTileClass}
              email={participant.email ?? undefined}
              image={participant.image}
              name={participant.name}
              size={channelCard ? "xs" : "sm"}
              userId={participant.userId ?? undefined}
            />
          )}
        </span>
      ))}
    </span>
  );
}

export function MessageThreadReply({
  channelCard = false,
  embeddedInRow = false,
  onOpenThread,
  replyCount,
  summary,
}: {
  /** Channel topic card footer — smaller face stack like Figma. */
  channelCard?: boolean;
  /** Parent row is the click target (inbox list); avoid nested buttons. */
  embeddedInRow?: boolean;
  onOpenThread: () => void;
  replyCount: number;
  summary?: ThreadSummary;
}) {
  const effectiveCount = summary?.replyCount ?? replyCount;
  const hasReplies = effectiveCount > 0;
  const replyLabel = hasReplies
    ? `${effectiveCount} ${effectiveCount === 1 ? "reply" : "replies"}`
    : null;
  const lastReplyLabel = hasReplies
    ? formatThreadLastReply(summary?.lastReplyAt)
    : null;

  const content = hasReplies ? (
    <>
      <ThreadParticipantStack
        channelCard={channelCard}
        participants={summary?.participants ?? []}
      />
      <span
        className={cn(
          "inline-flex min-w-0 shrink items-center gap-0.5 font-medium group-hover/thread-reply:underline",
          CHAT_THREAD_REPLY_LINK_CLASS
        )}
      >
        <span className="truncate">{replyLabel}</span>
        <span
          aria-hidden
          className={cn("shrink-0", CHAT_THREAD_REPLY_LINK_CLASS)}
        >
          ›
        </span>
      </span>
      {lastReplyLabel ? (
        <span className="truncate text-muted-foreground">{lastReplyLabel}</span>
      ) : null}
    </>
  ) : (
    <span className="inline-flex min-w-0 shrink items-center gap-1 font-medium text-muted-foreground group-hover/thread-reply:underline">
      <span>Reply</span>
      <span aria-hidden className="shrink-0">
        ›
      </span>
    </span>
  );

  if (embeddedInRow) {
    return (
      <span
        aria-hidden={hasReplies}
        className={cn(
          "group/thread-reply inline-flex max-w-full min-w-0 items-center text-left",
          channelCard
            ? "gap-2 py-0 text-xs leading-snug"
            : "gap-2 py-0.5 text-xs"
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      aria-label={hasReplies ? undefined : "Reply"}
      className={cn(
        "group/thread-reply inline-flex max-w-full min-w-0 cursor-pointer items-center rounded-sm text-left",
        channelCard ? "gap-2 py-0 text-xs leading-snug" : "gap-2 py-0.5 text-xs"
      )}
      onClick={onOpenThread}
      type="button"
    >
      {content}
    </button>
  );
}
