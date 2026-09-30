import type { RoomParticipantSummary } from "@/core/lib/chat/room-participants";
import type { Chat } from "@/core/lib/db/tables";

/** Max member names inlined in the system prompt; larger rooms show a count + cap. */
export const ROOM_KIMIRO_ROSTER_INLINE_CAP = 25;

export function formatRoomKimiroContextPrompt(args: {
  chat: Pick<Chat, "kind" | "title">;
  participants: RoomParticipantSummary[];
  askerUserId: string;
  askerDisplayName: string;
}): string {
  const total = args.participants.length;
  const sorted = [...args.participants].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, {
      sensitivity: "base",
    })
  );

  const conversationLabel =
    args.chat.kind === "channel"
      ? `channel #${args.chat.title?.trim() || "untitled"}`
      : args.chat.kind === "group_dm"
        ? "group direct message"
        : "direct message";

  const formatMember = (participant: RoomParticipantSummary) => {
    const asking =
      participant.userId === args.askerUserId ? " (asking user)" : "";
    const emailHint =
      participant.email === participant.displayName
        ? ""
        : ` (${participant.email})`;
    return `- ${participant.displayName}${asking}${emailHint}`;
  };

  const rosterBlock =
    total <= ROOM_KIMIRO_ROSTER_INLINE_CAP
      ? sorted.map(formatMember).join("\n")
      : [
          ...sorted.slice(0, ROOM_KIMIRO_ROSTER_INLINE_CAP).map(formatMember),
          `- … and ${total - ROOM_KIMIRO_ROSTER_INLINE_CAP} more members (not listed)`,
        ].join("\n");

  return [
    `## Shared conversation (${conversationLabel})`,
    "",
    "This is a multiplayer workspace chat. Message history uses `[Name]:` prefixes on each line so you can tell who said what.",
    'When you want someone to act, address them by display name (e.g. "Prasad, please review …") in your reply; everyone in the conversation can see it.',
    "",
    `Members (${total}):`,
    rosterBlock,
    "",
    `The user who invoked you this turn is ${args.askerDisplayName}.`,
  ].join("\n");
}
