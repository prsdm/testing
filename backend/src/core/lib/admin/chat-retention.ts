import { and, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "@/core/lib/db/client";
import { listTenantsWithChatRetention } from "@/core/lib/db/general-settings-queries";
import { chat, message, stream, vote } from "@/core/lib/db/tables";

const db = getDb();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function purgeExpiredChatsForTenantId(args: {
  tenantId: string;
  retentionDays: number;
}) {
  const cutoff = new Date(Date.now() - args.retentionDays * MS_PER_DAY);

  const oldChats = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.tenantId, args.tenantId), lt(chat.createdAt, cutoff)));

  if (oldChats.length === 0) {
    return 0;
  }

  const chatIds = oldChats.map((row) => row.id);
  const deleted = await db.transaction(async (tx) => {
    await tx.delete(vote).where(inArray(vote.chatId, chatIds));
    await tx.delete(message).where(inArray(message.chatId, chatIds));
    await tx.delete(stream).where(inArray(stream.chatId, chatIds));
    return await tx
      .delete(chat)
      .where(inArray(chat.id, chatIds))
      .returning({ id: chat.id });
  });
  return deleted.length;
}

export async function purgeExpiredChatsForTenant(args: {
  tenantId: string;
  retentionDays: number;
}) {
  if (args.retentionDays < 1) {
    return { deletedCount: 0, tenantId: args.tenantId };
  }
  const deletedCount = await purgeExpiredChatsForTenantId({
    retentionDays: args.retentionDays,
    tenantId: args.tenantId,
  });
  return { deletedCount, tenantId: args.tenantId };
}

export async function purgeExpiredChatsForAllTenants() {
  const rows = await listTenantsWithChatRetention();
  let totalDeleted = 0;
  const perTenant: Array<{ tenantId: string; deletedCount: number }> = [];

  for (const row of rows) {
    if (!row.maximumChatRetentionDays) {
      continue;
    }
    const result = await purgeExpiredChatsForTenant({
      retentionDays: row.maximumChatRetentionDays,
      tenantId: row.tenantId,
    });
    totalDeleted += result.deletedCount;
    if (result.deletedCount > 0) {
      perTenant.push({
        deletedCount: result.deletedCount,
        tenantId: row.tenantId,
      });
    }
  }

  return { perTenant, totalDeleted };
}
