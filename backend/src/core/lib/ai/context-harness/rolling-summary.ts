import type { UIMessage } from "ai";

export type ChatContextSummaryState = {
  summary: string;
  throughMessageId: string;
  updatedAt: string;
};

export function chatContextSummaryFromRow(row: {
  contextSummary?: string | null;
  contextSummaryThroughMessageId?: string | null;
  contextSummaryUpdatedAt?: Date | null;
}): ChatContextSummaryState | null {
  if (
    !row.contextSummary?.trim() ||
    !row.contextSummaryThroughMessageId ||
    !row.contextSummaryUpdatedAt
  ) {
    return null;
  }
  return {
    summary: row.contextSummary.trim(),
    throughMessageId: row.contextSummaryThroughMessageId,
    updatedAt: row.contextSummaryUpdatedAt.toISOString(),
  };
}

/** UI messages after the persisted summary bookmark (exclusive of summarized prefix). */
export function activeUiMessagesAfterSummary(args: {
  uiMessages: UIMessage[];
  persistedSummary: ChatContextSummaryState | null;
}): UIMessage[] {
  const { uiMessages, persistedSummary } = args;
  if (!persistedSummary) {
    return uiMessages;
  }
  const bookmarkIndex = uiMessages.findIndex(
    (message) => message.id === persistedSummary.throughMessageId
  );
  if (bookmarkIndex === -1) {
    return uiMessages;
  }
  return uiMessages.slice(bookmarkIndex + 1);
}

export function splitUiMessagesForCompaction(
  uiMessages: UIMessage[],
  recentCount: number
): { older: UIMessage[]; recent: UIMessage[] } {
  if (uiMessages.length <= recentCount) {
    return { older: [], recent: uiMessages };
  }
  return {
    older: uiMessages.slice(0, uiMessages.length - recentCount),
    recent: uiMessages.slice(-recentCount),
  };
}

export function resolveSummaryThroughMessageId(args: {
  uiMessages: UIMessage[];
  persistedSummary: ChatContextSummaryState | null;
  foldedUiMessages: UIMessage[];
}): string | null {
  const lastFolded = args.foldedUiMessages.at(-1);
  if (lastFolded) {
    return lastFolded.id;
  }
  return args.persistedSummary?.throughMessageId ?? null;
}

export function isPersistedSummaryValid(args: {
  uiMessages: UIMessage[];
  persistedSummary: ChatContextSummaryState | null;
}): boolean {
  if (!args.persistedSummary) {
    return false;
  }
  return args.uiMessages.some(
    (message) => message.id === args.persistedSummary?.throughMessageId
  );
}
