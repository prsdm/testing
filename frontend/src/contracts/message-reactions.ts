export type MessageReaction = {
  chatId: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt?: string;
};

export type MessageReactionGroup = {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
  userIds: string[];
};
