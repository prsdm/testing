/** Browser-safe representation of a chat history entry. */
export type ChatSummary = {
  id: string;
  createdAt: string | Date;
  title: string;
  userId: string;
  tenantId: string;
  knowledgeBaseId: string | null;
  contextSummary: string | null;
  contextSummaryThroughMessageId: string | null;
  contextSummaryUpdatedAt: string | Date | null;
};

export type ChatHistory = {
  chats: ChatSummary[];
  hasMore: boolean;
};
