import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  buildMessageSearchSnippet,
  messagePlainTextFromRow,
} from "@/core/lib/chat/room-message-search-snippet";
import { getDb } from "@/core/lib/db/client";
import { chat, message } from "@/core/lib/db/tables";

export type RoomMessageSearchHit = {
  messageId: string;
  threadRootMessageId: string | null;
  role: string;
  createdAt: string;
  snippet: string;
  authorDisplayName: string | null;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

export async function searchRoomMessages(args: {
  chatId: string;
  tenantId: string;
  query: string;
  limit?: number;
}): Promise<RoomMessageSearchHit[]> {
  const trimmedQuery = args.query.trim();
  if (trimmedQuery.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const tenantId = args.tenantId;
  const limit = Math.min(Math.max(args.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const pattern = `%${escapeIlikePattern(trimmedQuery)}%`;
  const db = getDb();

  const rows = await db
    .select({ message })
    .from(message)
    .innerJoin(chat, eq(message.chatId, chat.id))
    .where(
      and(
        eq(message.chatId, args.chatId),
        eq(chat.tenantId, tenantId),
        or(
          sql`${message.parts}::text ILIKE ${pattern}`,
          sql`COALESCE(${message.metadata}->>'composerText', '') ILIKE ${pattern}`
        )
      )
    )
    .orderBy(desc(message.createdAt))
    .limit(limit);

  return rows
    .map(({ message: row }) => {
      const plainText = messagePlainTextFromRow({
        metadata: row.metadata,
        parts: row.parts,
      });
      const snippet = buildMessageSearchSnippet({
        query: trimmedQuery,
        text: plainText,
      });
      if (!snippet) {
        return null;
      }
      const metadata =
        row.metadata && typeof row.metadata === "object"
          ? (row.metadata as {
              authorDisplayName?: string;
              agentName?: string;
            })
          : null;
      const authorDisplayName =
        row.role === "user"
          ? (metadata?.authorDisplayName ?? null)
          : (metadata?.agentName ?? "Kimiro");

      return {
        authorDisplayName,
        createdAt: row.createdAt.toISOString(),
        messageId: row.id,
        role: row.role,
        snippet,
        threadRootMessageId: row.threadRootMessageId ?? null,
      } satisfies RoomMessageSearchHit;
    })
    .filter((hit): hit is RoomMessageSearchHit => hit !== null);
}
