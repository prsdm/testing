/** 4×3 add-reaction picker (row-major). */
export const PICKER_MESSAGE_REACTIONS = [
  "✅",
  "👀",
  "👏",
  "👍",
  "❤️",
  "😂",
  "🎉",
  "🔥",
  "💯",
  "🚀",
  "🎯",
  "💡",
] as const;

const allowedReactionEmoji = new Set<string>(PICKER_MESSAGE_REACTIONS);

export function isAllowedMessageReactionEmoji(emoji: string): boolean {
  return allowedReactionEmoji.has(emoji);
}

const reactionEmojiOrder = new Map<string, number>(
  PICKER_MESSAGE_REACTIONS.map((emoji, index) => [emoji, index])
);

export function messageReactionEmojiSortIndex(emoji: string): number {
  return reactionEmojiOrder.get(emoji) ?? 999;
}
