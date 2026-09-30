import type { MessageReaction } from "@/contracts/message-reactions";

export async function toggleMessageReaction(args: {
  chatId: string;
  messageId: string;
  emoji: string;
  currentUserId: string;
}): Promise<void> {
  const basePath = process.env.KIMIRO_BASE_PATH ?? "";
  const response = await fetch(`${basePath}/api/reactions`, {
    body: JSON.stringify({
      chatId: args.chatId,
      emoji: args.emoji,
      messageId: args.messageId,
    }),
    headers: { "content-type": "application/json" },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("Failed to toggle reaction");
  }
}

export function optimisticToggleReaction(args: {
  reactions: MessageReaction[];
  chatId: string;
  messageId: string;
  emoji: string;
  currentUserId: string;
}): MessageReaction[] {
  const index = args.reactions.findIndex(
    (reaction) =>
      reaction.messageId === args.messageId &&
      reaction.userId === args.currentUserId &&
      reaction.emoji === args.emoji
  );

  if (index >= 0) {
    return args.reactions.filter((_, i) => i !== index);
  }

  return [
    ...args.reactions,
    {
      chatId: args.chatId,
      emoji: args.emoji,
      messageId: args.messageId,
      userId: args.currentUserId,
    },
  ];
}

export function reactionsApiUrl(chatId: string): string {
  return `${process.env.KIMIRO_BASE_PATH ?? ""}/api/reactions?chatId=${chatId}`;
}
