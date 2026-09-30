"use client";

import type { ReactNode } from "react";
import { formatMessageSectionTime } from "@/lib/chat/message-section-time";
import { cn } from "@/shared/utils";

function InboxListRowBody({
  activityTimeLabel,
  createdAtIso,
  footerRight,
  preview,
  selected,
  threadReply,
  title,
}: {
  activityTimeLabel: string | null;
  createdAtIso?: string;
  footerRight?: ReactNode;
  preview?: string;
  selected: boolean;
  threadReply?: ReactNode;
  title?: string;
}) {
  const showMetaFooter = threadReply || activityTimeLabel;

  return (
    <div className="space-y-1.5">
      {title ? (
        <p
          className={cn(
            "min-w-0 truncate text-[14px] text-foreground leading-snug",
            selected ? "font-bold" : "font-semibold"
          )}
        >
          {title}
        </p>
      ) : null}
      {preview ? (
        <p className="min-w-0 truncate text-[13px] text-muted-foreground leading-snug">
          {preview}
        </p>
      ) : null}
      {footerRight ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {footerRight}
        </div>
      ) : null}
      {showMetaFooter ? (
        <div className="flex min-w-0 items-center justify-between gap-3 pt-1.5">
          <div className="min-w-0 flex-1 overflow-hidden">{threadReply}</div>
          {activityTimeLabel ? (
            <time
              className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground leading-snug tabular-nums"
              dateTime={createdAtIso}
            >
              {activityTimeLabel}
            </time>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function ChannelTopicMessageCard({
  children,
  className,
  displayName,
  createdAt,
  footerRight,
  headerLeading,
  highlighted = false,
  inboxList = false,
  onOpenThread,
  selected = false,
  preview,
  title,
  threadReply,
}: {
  children?: ReactNode;
  className?: string;
  displayName: string;
  createdAt?: string;
  footerRight?: ReactNode;
  /** Avatar tile inside the card header (next to display name). */
  headerLeading?: ReactNode;
  highlighted?: boolean;
  /** Mail-style list row (subject + snippet, no full body). */
  inboxList?: boolean;
  onOpenThread?: () => void;
  /** Selected thread in split list. */
  selected?: boolean;
  preview?: string;
  title?: string;
  threadReply?: ReactNode;
}) {
  const showFooter = footerRight || threadReply;
  const headerDetailTimeLabel = createdAt
    ? formatMessageSectionTime(createdAt)
    : null;
  const headerTimeLabel = headerDetailTimeLabel;
  if (inboxList) {
    const interactive = Boolean(onOpenThread);
    const rowPadding = selected ? "py-3.5 pr-4 pl-[13px]" : "p-3.5 px-4";

    return (
      <article
        className={cn(
          "relative min-w-0 w-full border-0 border-border border-b bg-transparent text-left transition-colors",
          selected &&
            "border-l-[3px] border-solid border-l-neutral-400 bg-neutral-100 dark:border-l-neutral-500 dark:bg-muted/45",
          !selected && interactive && "hover:bg-muted/60",
          highlighted && !selected && "bg-[#fff9e6] dark:bg-amber-950/35",
          className
        )}
      >
        {interactive ? (
          <button
            className={cn(
              "block w-full text-left transition-colors",
              rowPadding,
              "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            )}
            onClick={onOpenThread}
            type="button"
          >
            <InboxListRowBody
              activityTimeLabel={headerDetailTimeLabel}
              createdAtIso={createdAt}
              footerRight={footerRight}
              preview={preview}
              selected={selected}
              threadReply={threadReply}
              title={title}
            />
          </button>
        ) : (
          <div className={rowPadding}>
            <InboxListRowBody
              activityTimeLabel={headerDetailTimeLabel}
              createdAtIso={createdAt}
              footerRight={footerRight}
              preview={preview}
              selected={selected}
              threadReply={threadReply}
              title={title}
            />
          </div>
        )}
      </article>
    );
  }

  return (
    <article
      className={cn(
        "relative min-w-0 w-full overflow-visible rounded-lg border bg-card shadow-sm transition-colors",
        selected ? "border-primary/40 bg-muted/40" : "border-border/70",
        highlighted &&
          !selected &&
          "border-amber-200/80 bg-[#fff9e6] dark:border-amber-900/50 dark:bg-amber-950/35",
        className
      )}
    >
      <div className={cn("px-4 pt-3", showFooter ? "pb-4" : "pb-3.5")}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {headerLeading ? (
              <div className="shrink-0 self-start" data-message-author-avatar>
                {headerLeading}
              </div>
            ) : null}
            <span className="min-w-0 truncate font-semibold text-foreground text-sm leading-snug">
              {displayName}
            </span>
          </div>
          {headerTimeLabel ? (
            <span className="shrink-0 pt-0.5 text-muted-foreground text-xs leading-snug tabular-nums">
              {headerTimeLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-2 min-w-0 text-[15px] text-foreground leading-snug">
          {children}
        </div>
      </div>
      {showFooter ? (
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border/30"
          />
          <div className="flex min-w-0 flex-1 flex-wrap items-center">
            {threadReply}
          </div>
          {footerRight ? (
            <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {footerRight}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Full-width row wrapper for a channel topic card. */
export function ChannelTopicMessageRow({
  children,
  className,
  inboxList = false,
}: {
  children: ReactNode;
  className?: string;
  inboxList?: boolean;
}) {
  return (
    <div className={cn("min-w-0 w-full", inboxList ? undefined : className)}>
      {children}
    </div>
  );
}
