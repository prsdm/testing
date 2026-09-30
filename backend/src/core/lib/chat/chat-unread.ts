import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { assertChatReadable } from "@/core/lib/chat/chat-access";
import { getDb } from "@/core/lib/db/client";
import { type Chat, chatParticipants, message } from "@/core/lib/db/tables";

const db = getDb();

function unreadMessageFilter(args: {
  authUserId: string;
  chatId: string;
  readThrough: Date;
}) {
  return and(
    eq(message.chatId, args.chatId),
    gt(message.createdAt, args.readThrough),
    or(
      sql`${message.role} <> 'user'`,
      sql`COALESCE(${message.metadata}->>'authorAuthUserId', '') <> ${args.authUserId}`
    )
  );
}

function zeroUnreadCounts(chatIds: string[]): Map<string, number> {
  return new Map(chatIds.map((chatId) => [chatId, 0]));
}

function isMissingLastReadColumn(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "42703"
  );
}

export async function getUnreadCountsForChats(args: {
  authUserId: string;
  chatIds: string[];
}): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (args.chatIds.length === 0) {
    return result;
  }

  let participants: Array<{
    chatId: string;
    createdAt: Date;
    lastReadAt: Date | null;
  }>;
  try {
    participants = await db
      .select({
        chatId: chatParticipants.chatId,
        createdAt: chatParticipants.createdAt,
        lastReadAt: chatParticipants.lastReadAt,
      })
      .from(chatParticipants)
      .where(
        and(
          eq(chatParticipants.userId, args.authUserId),
          inArray(chatParticipants.chatId, args.chatIds)
        )
      );
  } catch (error) {
    if (isMissingLastReadColumn(error)) {
      return zeroUnreadCounts(args.chatIds);
    }
    throw error;
  }

  for (const participant of participants) {
    const readThrough = participant.lastReadAt ?? participant.createdAt;
    const [row] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(message)
      .where(
        unreadMessageFilter({
          authUserId: args.authUserId,
          chatId: participant.chatId,
          readThrough,
        })
      );
    result.set(participant.chatId, row?.count ?? 0);
  }

  for (const chatId of args.chatIds) {
    if (!result.has(chatId)) {
      result.set(chatId, 0);
    }
  }

  return result;
}

export async function getLatestMessageCreatedAt(
  chatId: string
): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: message.createdAt })
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(sql`${message.createdAt} DESC`)
    .limit(1);
  return row?.createdAt ?? null;
}

export async function markChatReadForUser(args: {
  authUserId: string;
  chat: Chat;
  tenantUserId: string;
  readAt?: Date;
}) {
  await assertChatReadable({
    authUserId: args.authUserId,
    chat: args.chat,
    tenantUserId: args.tenantUserId,
  });

  const readAt =
    args.readAt ??
    (await getLatestMessageCreatedAt(args.chat.id)) ??
    new Date();

  try {
    await db
      .update(chatParticipants)
      .set({ lastReadAt: readAt })
      .where(
        and(
          eq(chatParticipants.chatId, args.chat.id),
          eq(chatParticipants.userId, args.authUserId)
        )
      );
  } catch (error) {
    if (!isMissingLastReadColumn(error)) {
      throw error;
    }
  }

  return readAt;
}

export async function listChatParticipantAuthUserIds(
  chatId: string
): Promise<string[]> {
  const rows = await db
    .select({ userId: chatParticipants.userId })
    .from(chatParticipants)
    .where(eq(chatParticipants.chatId, chatId));
  return rows.map((row) => row.userId);
}
