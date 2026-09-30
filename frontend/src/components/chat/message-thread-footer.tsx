"use client";

import type { ReactNode } from "react";
import { cn } from "@/shared/utils";

/** Slack-style row: hover actions, then avatar stack + reply link + last reply time. */
export function MessageThreadFooter({
  actions,
  actionsAfterThread = false,
  align,
  children,
  className,
  threadReplyControl,
}: {
  align: "start" | "end";
  /** Peer messages: copy after “Last reply …”. */
  actionsAfterThread?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  threadReplyControl?: ReactNode;
}) {
  if (!(actions || threadReplyControl || children)) {
    return null;
  }

  const actionSlot = actionsAfterThread ? null : actions;
  const trailingActions = actionsAfterThread ? actions : null;

  return (
    <div
      className={cn(
        "mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
        align === "end"
          ? "w-fit max-w-full justify-end self-end"
          : "w-full justify-start",
        className
      )}
      data-message-thread-footer
    >
      {actionSlot}
      {threadReplyControl}
      {trailingActions}
      {children}
    </div>
  );
}
