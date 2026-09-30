import { and, asc, desc, eq } from "drizzle-orm";
import {
  addChannelMemberToKnowledgeBase,
  createDedicatedChannelKnowledgeBase,
  getKnowledgeBaseForChannel,
  removeChannelMemberFromKnowledgeBase,
} from "@/core/lib/chat/channel-knowledge-base";
import { assertChatOwner } from "@/core/lib/chat/chat-access";
import { getDb } from "@/core/lib/db/client";
import {
  authUser,
  type Chat,
  chat,
  chatParticipants,
  tenantMembers,
  tenants,
} from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";
import { generateUUID } from "@/shared/utils";

const db = getDb();

export type ChannelSummary = Chat & {
  participantRole: "owner" | "member";
};

export type ChannelMemberRow = {
  userId: string;
  role: "owner" | "member";
  email: string;
  displayName: string;
  image: string | null;
  createdAt: Date;
};

export type ChannelMemberPickerRow = {
  userId: string;
  email: string;
  displayName: string;
  image: string | null;
};

function resolveDisplayName(args: {
  userName: string | null;
  email: string;
}): string {
  const trimmed = args.userName?.trim();
  return trimmed || args.email;
}

async function assertActiveTenantMember(args: {
  tenantId: string;
  authUserId: string;
}) {
  const [member] = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.authUserId),
        eq(tenantMembers.isActive, true)
      )
    )
    .limit(1);

  if (!member) {
    throw new ChatbotError(
      "bad_request:api",
      "User is not an active workspace member"
    );
  }
}

export async function listChannelsForUser(args: {
  tenantId: string;
  authUserId: string;
}): Promise<ChannelSummary[]> {
  const rows = await db
    .select({
      chat,
      role: chatParticipants.role,
    })
    .from(chatParticipants)
    .innerJoin(chat, eq(chatParticipants.chatId, chat.id))
    .where(
      and(
        eq(chat.tenantId, args.tenantId),
        eq(chat.kind, "channel"),
        eq(chatParticipants.userId, args.authUserId)
      )
    )
    .orderBy(desc(chat.createdAt));

  return rows.map((row) => ({
    ...row.chat,
    participantRole: row.role,
  }));
}

export async function createChannel(args: {
  tenantId: string;
  creatorAuthUserId: string;
  creatorTenantUserId: string;
  name: string;
  memberAuthUserIds: string[];
}): Promise<Chat> {
  const trimmedName = args.name.trim();
  if (!trimmedName) {
    throw new ChatbotError("bad_request:api", "Channel name is required");
  }

  const uniqueMemberIds = [
    ...new Set(
      args.memberAuthUserIds.filter((id) => id !== args.creatorAuthUserId)
    ),
  ];

  await assertActiveTenantMember({
    authUserId: args.creatorAuthUserId,
    tenantId: args.tenantId,
  });

  for (const memberId of uniqueMemberIds) {
    await assertActiveTenantMember({
      authUserId: memberId,
      tenantId: args.tenantId,
    });
  }

  const chatId = generateUUID();
  const now = new Date();

  const [created] = await db
    .insert(chat)
    .values({
      createdAt: now,
      id: chatId,
      kind: "channel",
      knowledgeBaseId: null,
      tenantId: args.tenantId,
      title: trimmedName,
      userId: args.creatorTenantUserId,
    })
    .returning();

  if (!created) {
    throw new ChatbotError("bad_request:database", "Failed to create channel");
  }

  await db.insert(chatParticipants).values([
    {
      addedByUserId: args.creatorAuthUserId,
      chatId,
      role: "owner",
      userId: args.creatorAuthUserId,
    },
    ...uniqueMemberIds.map((userId) => ({
      addedByUserId: args.creatorAuthUserId,
      chatId,
      role: "member" as const,
      userId,
    })),
  ]);

  const channelKb = await createDedicatedChannelKnowledgeBase({
    channelChatId: chatId,
    channelTitle: trimmedName,
    creatorAuthUserId: args.creatorAuthUserId,
    tenantId: args.tenantId,
  });

  const [withKb] = await db
    .update(chat)
    .set({ knowledgeBaseId: channelKb.id })
    .where(eq(chat.id, chatId))
    .returning();

  return withKb ?? created;
}

export async function listChannelMembers(args: {
  chat: Chat;
  authUserId: string;
  tenantUserId: string;
}): Promise<ChannelMemberRow[]> {
  if (args.chat.kind !== "channel") {
    throw new ChatbotError("bad_request:api", "Not a channel chat");
  }

  const role = await db
    .select({ role: chatParticipants.role })
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, args.chat.id),
        eq(chatParticipants.userId, args.authUserId)
      )
    )
    .limit(1);

  if (!role.at(0)) {
    throw new ChatbotError("forbidden:chat");
  }

  const rows = await db
    .select({
      createdAt: chatParticipants.createdAt,
      email: tenantMembers.email,
      image: authUser.image,
      role: chatParticipants.role,
      userId: chatParticipants.userId,
      userName: authUser.name,
    })
    .from(chatParticipants)
    .innerJoin(authUser, eq(chatParticipants.userId, authUser.id))
    .innerJoin(
      tenantMembers,
      and(
        eq(tenantMembers.authUserId, chatParticipants.userId),
        eq(tenantMembers.tenantId, args.chat.tenantId)
      )
    )
    .where(eq(chatParticipants.chatId, args.chat.id))
    .orderBy(asc(tenantMembers.email));

  return rows.map((row) => ({
    createdAt: row.createdAt,
    displayName: resolveDisplayName({
      email: row.email,
      userName: row.userName,
    }),
    email: row.email,
    image: row.image,
    role: row.role,
    userId: row.userId,
  }));
}

export async function listChannelMemberPickerOptions(args: {
  chat: Chat;
  authUserId: string;
  tenantUserId: string;
}): Promise<ChannelMemberPickerRow[]> {
  await assertChatOwner({
    authUserId: args.authUserId,
    chat: args.chat,
    tenantUserId: args.tenantUserId,
  });

  const existing = await db
    .select({ userId: chatParticipants.userId })
    .from(chatParticipants)
    .where(eq(chatParticipants.chatId, args.chat.id));

  const excluded = new Set(existing.map((row) => row.userId));

  const rows = await db
    .select({
      email: tenantMembers.email,
      image: authUser.image,
      isActive: tenantMembers.isActive,
      userId: tenantMembers.authUserId,
      userName: authUser.name,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
    .where(eq(tenants.id, args.chat.tenantId))
    .orderBy(asc(tenantMembers.email));

  return rows
    .filter((row) => row.isActive && !excluded.has(row.userId))
    .map((row) => ({
      displayName: resolveDisplayName({
        email: row.email,
        userName: row.userName,
      }),
      email: row.email,
      image: row.image,
      userId: row.userId,
    }));
}

export async function addChannelMember(args: {
  chat: Chat;
  actorAuthUserId: string;
  actorTenantUserId: string;
  memberAuthUserId: string;
}) {
  await assertChatOwner({
    authUserId: args.actorAuthUserId,
    chat: args.chat,
    tenantUserId: args.actorTenantUserId,
  });

  await assertActiveTenantMember({
    authUserId: args.memberAuthUserId,
    tenantId: args.chat.tenantId,
  });

  const [created] = await db
    .insert(chatParticipants)
    .values({
      addedByUserId: args.actorAuthUserId,
      chatId: args.chat.id,
      role: "member",
      userId: args.memberAuthUserId,
    })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    throw new ChatbotError(
      "bad_request:api",
      "Member is already in the channel"
    );
  }

  const kb = await getKnowledgeBaseForChannel(args.chat.id);
  if (kb) {
    await addChannelMemberToKnowledgeBase({
      addedByUserId: args.actorAuthUserId,
      channelChatId: args.chat.id,
      knowledgeBaseId: kb.id,
      memberAuthUserId: args.memberAuthUserId,
      ownerAuthUserId: kb.createdByUserId,
    });
  }

  return created;
}

export async function removeChannelMember(args: {
  chat: Chat;
  actorAuthUserId: string;
  actorTenantUserId: string;
  memberAuthUserId: string;
}) {
  await assertChatOwner({
    authUserId: args.actorAuthUserId,
    chat: args.chat,
    tenantUserId: args.actorTenantUserId,
  });

  if (args.memberAuthUserId === args.actorAuthUserId) {
    throw new ChatbotError(
      "bad_request:api",
      "Transfer ownership before leaving"
    );
  }

  const [removed] = await db
    .delete(chatParticipants)
    .where(
      and(
        eq(chatParticipants.chatId, args.chat.id),
        eq(chatParticipants.userId, args.memberAuthUserId),
        eq(chatParticipants.role, "member")
      )
    )
    .returning();

  if (!removed) {
    throw new ChatbotError("not_found:api", "Channel member not found");
  }

  const kb = await getKnowledgeBaseForChannel(args.chat.id);
  if (kb) {
    await removeChannelMemberFromKnowledgeBase({
      knowledgeBaseId: kb.id,
      memberAuthUserId: args.memberAuthUserId,
      ownerAuthUserId: kb.createdByUserId,
    });
  }

  return removed;
}
