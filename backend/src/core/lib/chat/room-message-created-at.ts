import { and, eq, isNull, max, sql } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { chat, message } from "@/core/lib/db/tables";

const GAP_MS = 10;

/** Strict ordering when several room messages land in the same clock millisecond. */
export async function nextRoomMessageCreatedAtPair(args: {
  chatId: string;
  tenantId: string;
  historyThreadRootMessageId?: string;
}): Promise<{ assistant: Date; user: Date }> {
  const db = getDb();
  const tenantId = args.tenantId;
  const threadRoot = args.historyThreadRootMessageId;
  const threadFilter = threadRoot
    ? sql`(${message.id} = ${threadRoot} OR ${message.threadRootMessageId} = ${threadRoot})`
    : isNull(message.threadRootMessageId);

  const [row] = await db
    .select({ latest: max(message.createdAt) })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(
      and(
        eq(message.chatId, args.chatId),
        eq(chat.tenantId, tenantId),
        threadFilter
      )
    );

  const baseMs = row?.latest
    ? new Date(row.latest).getTime() + GAP_MS
    : Date.now();
  const user = new Date(baseMs);
  return {
    assistant: new Date(baseMs + 1),
    user,
  };
}
