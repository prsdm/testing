"use client";

import type { ReactNode } from "react";
import { MESSAGE_HEADER_TILE_CLASS } from "@/components/chat/kimiro-icon";
import { cn } from "@/shared/utils";
import { MessageTimestamp } from "./message-timestamp";

const messageAuthorAvatarSpacerClass = cn(
  MESSAGE_HEADER_TILE_CLASS,
  "mt-0.5 self-start"
);

export function MessageAuthorLayout({
  align = "start",
  children,
  className,
  continuation = false,
  createdAt,
  displayName,
  leading,
}: {
  align?: "start" | "end";
  children: ReactNode;
  className?: string;
  /** Same author block — hide avatar/name/time, indent body like Slack. */
  continuation?: boolean;
  createdAt?: string;
  displayName: string;
  leading: ReactNode;
}) {
  if (continuation) {
    const avatarSpacer = (
      <div aria-hidden className={messageAuthorAvatarSpacerClass} />
    );
    return (
      <div
        className={cn(
          "flex w-full min-w-0 gap-2.5",
          align === "end" ? "flex-row justify-end" : "flex-row",
          className
        )}
      >
        {align === "end" ? (
          <>
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col items-end gap-1",
                "max-w-[calc(100%-6rem)] sm:max-w-[min(fit-content,58%)]"
              )}
            >
              {children}
            </div>
            {avatarSpacer}
          </>
        ) : (
          <>
            {avatarSpacer}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              {children}
            </div>
          </>
        )}
      </div>
    );
  }
  const name = (
    <span className="truncate font-medium text-foreground text-sm">
      {displayName}
    </span>
  );

  const authorLine = (
    <div
      className={cn(
        "flex min-w-0 max-w-full items-baseline gap-2",
        align === "end" ? "justify-end" : "justify-start"
      )}
    >
      {align === "end" ? (
        <>
          <MessageTimestamp createdAt={createdAt} />
          {name}
        </>
      ) : (
        <>
          {name}
          <MessageTimestamp createdAt={createdAt} />
        </>
      )}
    </div>
  );

  const bodyColumn = (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1",
        align === "end" ? "items-end" : "items-start"
      )}
    >
      {authorLine}
      {children}
    </div>
  );

  const avatarColumn = (
    <div className={messageAuthorAvatarSpacerClass} data-message-author-avatar>
      {leading}
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-full min-w-0 gap-2.5",
        align === "end" ? "flex-row justify-end" : "flex-row",
        className
      )}
    >
      {align === "end" ? (
        <>
          {bodyColumn}
          {avatarColumn}
        </>
      ) : (
        <>
          {avatarColumn}
          {bodyColumn}
        </>
      )}
    </div>
  );
}
