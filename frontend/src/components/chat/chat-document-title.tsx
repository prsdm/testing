"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useChatHistoryTitle } from "@/hooks/use-chat-history-title";
import { formatPageTitle, PAGE_TITLES } from "@/lib/metadata/page-titles";
import {
  CHAT_HOME,
  extractChatIdFromPath,
  isChatAreaPath,
} from "@/shared/chat/routes";

export function ChatDocumentTitle() {
  const pathname = usePathname();
  const chatId = extractChatIdFromPath(pathname);
  const chatTitle = useChatHistoryTitle(chatId);

  useEffect(() => {
    if (!isChatAreaPath(pathname)) {
      return;
    }

    if (!chatId || pathname === CHAT_HOME) {
      document.title = formatPageTitle(PAGE_TITLES.newChat);
      return;
    }

    document.title = formatPageTitle(chatTitle?.trim() || PAGE_TITLES.newChat);
  }, [chatId, chatTitle, pathname]);

  return null;
}
