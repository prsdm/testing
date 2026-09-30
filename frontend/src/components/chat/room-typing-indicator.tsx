import {
  filterRoomTypistsForScope,
  formatRoomTypingLabel,
} from "@/lib/chat/room-typing";
import type { ChatRoomTypist } from "@/shared/chat/chat-room-events";
import { cn } from "@/shared/utils";

export function RoomTypingIndicator({
  className,
  currentUserId,
  roomTypists,
  threadRootMessageId = null,
}: {
  className?: string;
  currentUserId?: string;
  roomTypists: ChatRoomTypist[];
  threadRootMessageId?: string | null;
}) {
  const label = formatRoomTypingLabel(
    filterRoomTypistsForScope({
      currentUserId,
      threadRootMessageId,
      typists: roomTypists,
    })
  );

  if (!label) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        "min-h-5 truncate px-2 text-muted-foreground text-xs md:px-4",
        className
      )}
    >
      {label}
    </p>
  );
}
