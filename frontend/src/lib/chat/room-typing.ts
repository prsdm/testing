import type { ChatRoomTypist } from "@/shared/chat/chat-room-events";

export function filterRoomTypistsForScope(args: {
  typists: ChatRoomTypist[];
  threadRootMessageId: string | null;
  currentUserId?: string;
}): ChatRoomTypist[] {
  return args.typists.filter(
    (typist) =>
      (typist.threadRootMessageId ?? null) === args.threadRootMessageId &&
      typist.userId !== args.currentUserId
  );
}

export function formatRoomTypingLabel(
  typists: ChatRoomTypist[]
): string | null {
  if (typists.length === 0) {
    return null;
  }
  const firstNames = typists.map((typist) => {
    const trimmed = typist.displayName.trim();
    const space = trimmed.indexOf(" ");
    return space > 0 ? trimmed.slice(0, space) : trimmed;
  });
  if (firstNames.length === 1) {
    return `${firstNames[0]} is typing…`;
  }
  if (firstNames.length === 2) {
    return `${firstNames[0]} and ${firstNames[1]} are typing…`;
  }
  return `${firstNames[0]} and ${firstNames.length - 1} others are typing…`;
}
