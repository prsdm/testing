"use client";

import type { ReactNode } from "react";
import { MESSAGE_HEADER_TILE_CLASS } from "@/components/chat/kimiro-icon";
import { UserAvatar } from "@/components/chat/user-avatar";
import { cn } from "@/shared/utils";
import { MessageAuthorLayout } from "./message-author-layout";

export function RoomMemberMessageLayout({
  align = "start",
  avatarName,
  children,
  className,
  continuation = false,
  createdAt,
  displayName,
  email,
  image,
  userId,
}: {
  align?: "start" | "end";
  avatarName?: string;
  children: ReactNode;
  className?: string;
  continuation?: boolean;
  createdAt?: string;
  displayName: string;
  email?: string | null;
  image?: string | null;
  userId?: string | null;
}) {
  const avatarLabel = avatarName?.trim() || displayName;

  return (
    <MessageAuthorLayout
      align={align}
      className={className}
      continuation={continuation}
      createdAt={createdAt}
      displayName={displayName}
      leading={
        <UserAvatar
          className={cn(MESSAGE_HEADER_TILE_CLASS, "ring-0")}
          email={email ?? undefined}
          image={image}
          name={avatarLabel}
          size="sm"
          userId={userId ?? undefined}
        />
      }
    >
      {children}
    </MessageAuthorLayout>
  );
}
