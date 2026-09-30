import type {
  MessageReaction,
  MessageReactionGroup,
} from "@/contracts/message-reactions";
import {
  isAllowedMessageReactionEmoji,
  messageReactionEmojiSortIndex,
} from "@/shared/chat/quick-reactions";

export function reactionsForMessage(
  reactions: MessageReaction[],
  messageId: string
): MessageReaction[] {
  return reactions.filter((reaction) => reaction.messageId === messageId);
}

export function groupMessageReactions(args: {
  reactions: MessageReaction[];
  messageId: string;
  currentUserId: string | null | undefined;
}): MessageReactionGroup[] {
  const forMessage = args.reactions.filter(
    (reaction) => reaction.messageId === args.messageId
  );
  const byEmoji = new Map<string, MessageReactionGroup>();

  for (const reaction of forMessage) {
    if (!isAllowedMessageReactionEmoji(reaction.emoji)) {
      continue;
    }
    const existing = byEmoji.get(reaction.emoji);
    if (existing) {
      existing.count += 1;
      existing.userIds.push(reaction.userId);
      if (reaction.userId === args.currentUserId) {
        existing.reactedByCurrentUser = true;
      }
      continue;
    }
    byEmoji.set(reaction.emoji, {
      count: 1,
      emoji: reaction.emoji,
      reactedByCurrentUser: reaction.userId === args.currentUserId,
      userIds: [reaction.userId],
    });
  }

  return [...byEmoji.values()].sort(
    (a, b) =>
      messageReactionEmojiSortIndex(a.emoji) -
      messageReactionEmojiSortIndex(b.emoji)
  );
}
