import type { ChatHistory, ChatSummary } from "@/contracts/chat";

type ChatHistoryPages = ChatHistory[] | undefined;

type ChatHistorySync = {
  prepend: (entry: ChatSummary) => void;
  updateTitle: (chatId: string, title: string) => void;
};

let activeSync: ChatHistorySync | null = null;

export function registerChatHistorySync(sync: ChatHistorySync) {
  activeSync = sync;
  return () => {
    if (activeSync === sync) {
      activeSync = null;
    }
  };
}

const OPTIMISTIC_USER_ID = "00000000-0000-4000-8000-000000000001";
const OPTIMISTIC_TENANT_ID = "00000000-0000-4000-8000-000000000002";

export function createOptimisticChatEntry(args: {
  id: string;
  title: string;
}): ChatSummary {
  return {
    contextSummary: null,
    contextSummaryThroughMessageId: null,
    contextSummaryUpdatedAt: null,
    createdAt: new Date(),
    id: args.id,
    knowledgeBaseId: null,
    tenantId: OPTIMISTIC_TENANT_ID,
    title: args.title,
    userId: OPTIMISTIC_USER_ID,
  };
}

export function prependChatToHistory(entry: ChatSummary) {
  activeSync?.prepend(entry);
}

export function updateChatTitleInHistory(chatId: string, title: string) {
  activeSync?.updateTitle(chatId, title);
}

export function prependChatToHistoryPages(
  pages: ChatHistoryPages,
  entry: ChatSummary
): ChatHistory[] | ChatHistoryPages {
  if (pages?.[0]?.chats.some((chat) => chat.id === entry.id)) {
    return pages;
  }
  const firstPage = pages?.[0] ?? { chats: [], hasMore: false };
  return [
    {
      ...firstPage,
      chats: [entry, ...firstPage.chats.filter((chat) => chat.id !== entry.id)],
    },
    ...(pages?.slice(1) ?? []),
  ];
}

export function updateChatTitleInHistoryPages(
  pages: ChatHistoryPages,
  chatId: string,
  title: string
): ChatHistoryPages {
  if (!pages) {
    return pages;
  }
  let changed = false;
  const nextPages = pages.map((page) => ({
    ...page,
    chats: page.chats.map((chat) => {
      if (chat.id !== chatId || chat.title === title) {
        return chat;
      }
      changed = true;
      return { ...chat, title };
    }),
  }));
  return changed ? nextPages : pages;
}
