"use client";

import { useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import {
  type ChatHistory,
  createChatHistoryPaginationKey,
} from "@/components/chat/sidebar-history";
import { useWorkspace } from "@/hooks/use-workspace";
import { fetcher } from "@/shared/utils";

/** Title for a workspace Kimiro chat from sidebar history cache (same source as the recents list). */
export function useChatHistoryTitle(chatId: string | null | undefined) {
  const { workspace } = useWorkspace();
  const workspaceSlug = workspace?.activeTenantSlug ?? workspace?.slug ?? null;
  const { data } = useSWRInfinite<ChatHistory>(
    workspaceSlug && chatId
      ? createChatHistoryPaginationKey(workspaceSlug)
      : () => null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return useMemo(() => {
    if (!chatId) {
      return null;
    }
    const chats = data?.flatMap((page) => page.chats) ?? [];
    return chats.find((chat) => chat.id === chatId)?.title ?? null;
  }, [chatId, data]);
}
