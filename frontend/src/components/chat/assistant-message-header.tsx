"use client";

import type { ReactNode } from "react";
import {
  AssistantIconTile,
  KimiroIconTile,
} from "@/components/chat/kimiro-icon";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import type { MessageMetadata } from "@/shared/types";
import { MessageAuthorLayout } from "./message-author-layout";

type AssistantMessageLayoutProps = {
  children: ReactNode;
  className?: string;
  continuation?: boolean;
  createdAt?: string;
  displayName?: string;
  iconColor?: MessageMetadata["agentIconColor"];
  responderSlug: string;
};

export function AssistantMessageLayout({
  children,
  className,
  continuation = false,
  createdAt,
  displayName,
  iconColor,
  responderSlug,
}: AssistantMessageLayoutProps) {
  const isKimiro = responderSlug === DEFAULT_COMPOSER_ASSISTANT_SLUG;
  const label = displayName ?? responderSlug;

  return (
    <MessageAuthorLayout
      className={className}
      continuation={continuation}
      createdAt={createdAt}
      displayName={label}
      leading={
        isKimiro ? (
          <KimiroIconTile size="xs" />
        ) : (
          <AssistantIconTile iconColor={iconColor} size="xs" />
        )
      }
    >
      {children}
    </MessageAuthorLayout>
  );
}
