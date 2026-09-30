import { and, eq } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { type Chat, chatParticipants } from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";

const db = getDb();

export function isChannelChat(row: Pick<Chat, "kind">): boolean {
  return row.kind === "channel";
}

export function isOneToOneDmChat(row: Pick<Chat, "kind">): boolean {
  return row.kind === "dm";
}

export function isGroupDmChat(row: Pick<Chat, "kind">): boolean {
  return row.kind === "group_dm";
}

/** 1:1 or group direct message. */
export function isDmChat(row: Pick<Chat, "kind">): boolean {
  return row.kind === "dm" || row.kind === "group_dm";
}

/** Channel or DM — multiplayer rooms (not solo Kimiro chat). */
export function isRoomChat(row: Pick<Chat, "kind">): boolean {
  return row.kind === "channel" || row.kind === "dm" || row.kind === "group_dm";
}

export async function getChatParticipantRole(args: {
  chatId: string;
  authUserId: string;
}): Promise<"owner" | "member" | null> {
  const [row] = await db
    .select({ role: chatParticipants.role })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, args.chatId),
        eq(chatParticipants.userId, args.authUserId)
      )
    )
    .limit(1);

  return row?.role ?? null;
}

export async function assertChatReadable(args: {
  chat: Chat;
  authUserId: string;
  tenantUserId: string;
}): Promise<void> {
  if (isRoomChat(args.chat)) {
    const role = await getChatParticipantRole({
      authUserId: args.authUserId,
      chatId: args.chat.id,
    });
    if (!role) {
      throw new ChatbotError("forbidden:chat");
    }
    return;
  }

  if (args.chat.userId !== args.tenantUserId) {
    throw new ChatbotError("forbidden:chat");
  }
}

export async function assertChatOwner(args: {
  chat: Chat;
  authUserId: string;
  tenantUserId: string;
}): Promise<void> {
  if (args.chat.kind === "channel") {
    const role = await getChatParticipantRole({
      authUserId: args.authUserId,
      chatId: args.chat.id,
    });
    if (role !== "owner") {
      throw new ChatbotError("forbidden:chat");
    }
    return;
  }

  if (args.chat.userId !== args.tenantUserId) {
    throw new ChatbotError("forbidden:chat");
  }
}
