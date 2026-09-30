import { and, eq, isNotNull } from "drizzle-orm";
import { getDb } from "./client";
import { tenantSlackIntegrationThreads } from "./tables";

const db = getDb();

export async function getSlackIntegrationThreadMapping(args: {
  tenantId: string;
  slackChannelId: string;
  slackThreadTs: string;
}) {
  const [row] = await db
    .select()
    .from(tenantSlackIntegrationThreads)
    .where(
      and(
        eq(tenantSlackIntegrationThreads.tenantId, args.tenantId),
        eq(tenantSlackIntegrationThreads.slackChannelId, args.slackChannelId),
        eq(tenantSlackIntegrationThreads.slackThreadTs, args.slackThreadTs)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function upsertSlackIntegrationThreadMapping(args: {
  tenantId: string;
  slackChannelId: string;
  slackThreadTs: string;
  chatId: string;
  authUserId: string;
}) {
  const [row] = await db
    .insert(tenantSlackIntegrationThreads)
    .values({
      authUserId: args.authUserId,
      chatId: args.chatId,
      slackChannelId: args.slackChannelId,
      slackThreadTs: args.slackThreadTs,
      tenantId: args.tenantId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      set: {
        authUserId: args.authUserId,
        chatId: args.chatId,
        updatedAt: new Date(),
      },
      target: [
        tenantSlackIntegrationThreads.tenantId,
        tenantSlackIntegrationThreads.slackChannelId,
        tenantSlackIntegrationThreads.slackThreadTs,
      ],
    })
    .returning();
  return row;
}

/** Clears pending approval only if one is still set; returns the claimed message ts. */
export async function claimSlackIntegrationPendingApprovalMessage(args: {
  tenantId: string;
  slackChannelId: string;
  slackThreadTs: string;
}) {
  const thread = await getSlackIntegrationThreadMapping(args);
  const messageTs = thread?.pendingApprovalMessageTs?.trim();
  if (!messageTs) {
    return null;
  }

  const [row] = await db
    .update(tenantSlackIntegrationThreads)
    .set({
      pendingApprovalMessageTs: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tenantSlackIntegrationThreads.tenantId, args.tenantId),
        eq(tenantSlackIntegrationThreads.slackChannelId, args.slackChannelId),
        eq(tenantSlackIntegrationThreads.slackThreadTs, args.slackThreadTs),
        eq(tenantSlackIntegrationThreads.pendingApprovalMessageTs, messageTs),
        isNotNull(tenantSlackIntegrationThreads.pendingApprovalMessageTs)
      )
    )
    .returning({ slackThreadTs: tenantSlackIntegrationThreads.slackThreadTs });

  return row ? messageTs : null;
}

export async function setSlackIntegrationThreadPendingApprovalMessageTs(args: {
  tenantId: string;
  slackChannelId: string;
  slackThreadTs: string;
  pendingApprovalMessageTs: string | null;
}) {
  const [row] = await db
    .update(tenantSlackIntegrationThreads)
    .set({
      pendingApprovalMessageTs: args.pendingApprovalMessageTs,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tenantSlackIntegrationThreads.tenantId, args.tenantId),
        eq(tenantSlackIntegrationThreads.slackChannelId, args.slackChannelId),
        eq(tenantSlackIntegrationThreads.slackThreadTs, args.slackThreadTs)
      )
    )
    .returning();
  return row ?? null;
}
