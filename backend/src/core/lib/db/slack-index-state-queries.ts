import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import { tenantSlackIndexedChannels } from "./tables";

const db = getDb();

export type SlackIndexChannelState = {
  channelId: string;
  channelName: string | null;
  lastMessageTs: string;
  lastStatus: string;
  lastIndexedAt: Date | null;
  indexedByUserId: string | null;
};

export async function getTenantSlackIndexStateMap(tenantId: string) {
  const rows = await db
    .select({
      channelId: tenantSlackIndexedChannels.channelId,
      channelName: tenantSlackIndexedChannels.channelName,
      indexedByUserId: tenantSlackIndexedChannels.indexedByUserId,
      lastIndexedAt: tenantSlackIndexedChannels.lastIndexedAt,
      lastMessageTs: tenantSlackIndexedChannels.lastMessageTs,
      lastStatus: tenantSlackIndexedChannels.lastStatus,
    })
    .from(tenantSlackIndexedChannels)
    .where(eq(tenantSlackIndexedChannels.tenantId, tenantId));

  return new Map(
    rows.map((row) => [
      row.channelId,
      {
        channelId: row.channelId,
        channelName: row.channelName,
        indexedByUserId: row.indexedByUserId,
        lastIndexedAt: row.lastIndexedAt,
        lastMessageTs: row.lastMessageTs,
        lastStatus: row.lastStatus,
      } satisfies SlackIndexChannelState,
    ])
  );
}

export async function upsertTenantSlackIndexedChannel(input: {
  tenantId: string;
  channelId: string;
  channelName?: string | null;
  lastMessageTs: string;
  lastStatus: "indexed" | "failed";
  indexedByUserId?: string | null;
}) {
  await db
    .insert(tenantSlackIndexedChannels)
    .values({
      channelId: input.channelId,
      channelName: input.channelName ?? null,
      indexedByUserId: input.indexedByUserId ?? null,
      lastIndexedAt: new Date(),
      lastMessageTs: input.lastMessageTs,
      lastStatus: input.lastStatus,
      tenantId: input.tenantId,
    })
    .onConflictDoUpdate({
      set: {
        channelName: input.channelName ?? null,
        lastIndexedAt: new Date(),
        lastMessageTs: input.lastMessageTs,
        lastStatus: input.lastStatus,
        ...(input.indexedByUserId === undefined
          ? {}
          : { indexedByUserId: input.indexedByUserId }),
      },
      target: [
        tenantSlackIndexedChannels.tenantId,
        tenantSlackIndexedChannels.channelId,
      ],
    });
}

export async function deleteTenantSlackIndexedChannels(input: {
  tenantId: string;
  channelIds: string[];
}) {
  if (input.channelIds.length === 0) {
    return;
  }
  await db
    .delete(tenantSlackIndexedChannels)
    .where(
      and(
        eq(tenantSlackIndexedChannels.tenantId, input.tenantId),
        inArray(tenantSlackIndexedChannels.channelId, input.channelIds)
      )
    );
}

/** Channels the caller may remove: own indexes, or all if admin. */
export async function filterSlackChannelsRemovableByUser(input: {
  tenantId: string;
  channelIds: string[];
  userId: string;
  isAdmin: boolean;
}) {
  if (input.channelIds.length === 0) {
    return [] as string[];
  }
  if (input.isAdmin) {
    return [...new Set(input.channelIds)];
  }

  const rows = await db
    .select({
      channelId: tenantSlackIndexedChannels.channelId,
      indexedByUserId: tenantSlackIndexedChannels.indexedByUserId,
    })
    .from(tenantSlackIndexedChannels)
    .where(
      and(
        eq(tenantSlackIndexedChannels.tenantId, input.tenantId),
        inArray(tenantSlackIndexedChannels.channelId, input.channelIds)
      )
    );

  return rows
    .filter((row) => row.indexedByUserId === input.userId)
    .map((row) => row.channelId);
}
