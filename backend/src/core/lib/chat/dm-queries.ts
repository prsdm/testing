import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { isGroupDmChat, isOneToOneDmChat } from "@/core/lib/chat/chat-access";
import { getDb } from "@/core/lib/db/client";
import {
  authUser,
  type Chat,
  chat,
  chatParticipants,
  tenantMembers,
} from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";
import { generateUUID } from "@/shared/utils";

const db = getDb();

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

export type DmMemberSummary = {
  userId: string;
  displayName: string;
  email: string;
  image: string | null;
};

export type DmSummary = {
  id: string;
  tenantId: string;
  createdAt: Date;
  isGroup: boolean;
  title: string;
  peerUserId: string;
  peerDisplayName: string;
  peerEmail: string;
  peerImage: string | null;
  members: DmMemberSummary[];
};

function resolveDisplayName(args: {
  userName: string | null;
  email: string;
}): string {
  const trimmed = args.userName?.trim();
  return trimmed || args.email;
}

function firstNameFromDisplayName(displayName: string): string {
  const trimmed = displayName.trim();
  const space = trimmed.indexOf(" ");
  return space > 0 ? trimmed.slice(0, space) : trimmed;
}

export function buildGroupDmTitle(displayNames: string[]): string {
  const names = displayNames.map(firstNameFromDisplayName).filter(Boolean);
  if (names.length === 0) {
    return "Group message";
  }
  if (names.length <= 3) {
    return names.join(", ");
  }
  const rest = names.length - 2;
  return `${names[0]}, ${names[1]}, and ${rest} others`;
}

async function countChatParticipants(chatId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatParticipants)
    .where(eq(chatParticipants.chatId, chatId));
  return row?.count ?? 0;
}

async function listDmMembersExceptUser(args: {
  chatId: string;
  authUserId: string;
}): Promise<DmMemberSummary[]> {
  const rows = await db
    .select({
      email: tenantMembers.email,
      image: authUser.image,
      userId: chatParticipants.userId,
      userName: authUser.name,
    })
    .from(chatParticipants)
    .innerJoin(
      tenantMembers,
      eq(tenantMembers.authUserId, chatParticipants.userId)
    )
    .innerJoin(authUser, eq(authUser.id, chatParticipants.userId))
    .where(
      and(
        eq(chatParticipants.chatId, args.chatId),
        ne(chatParticipants.userId, args.authUserId)
      )
    )
    .orderBy(tenantMembers.email);

  return rows.map((peer) => ({
    displayName: resolveDisplayName({
      email: peer.email,
      userName: peer.userName,
    }),
    email: peer.email,
    image: peer.image,
    userId: peer.userId,
  }));
}

export async function findExistingDirectMessage(args: {
  tenantId: string;
  authUserIdA: string;
  authUserIdB: string;
}): Promise<Chat | null> {
  if (args.authUserIdA === args.authUserIdB) {
    return null;
  }

  const candidates = await db
    .select({ chatId: chatParticipants.chatId })
    .from(chatParticipants)
    .innerJoin(chat, eq(chat.id, chatParticipants.chatId))
    .where(
      and(
        eq(chat.tenantId, args.tenantId),
        eq(chat.kind, "dm"),
        eq(chatParticipants.userId, args.authUserIdB)
      )
    );

  const peerChatIds = new Set(candidates.map((entry) => entry.chatId));
  const chatsForA = await db
    .select({ chat })
    .from(chat)
    .innerJoin(chatParticipants, eq(chatParticipants.chatId, chat.id))
    .where(
      and(
        eq(chat.tenantId, args.tenantId),
        eq(chat.kind, "dm"),
        eq(chatParticipants.userId, args.authUserIdA)
      )
    );

  for (const entry of chatsForA) {
    if (!peerChatIds.has(entry.chat.id)) {
      continue;
    }
    const participantCount = await countChatParticipants(entry.chat.id);
    if (participantCount === 2) {
      return entry.chat;
    }
  }

  return null;
}

export async function listDirectMessagesForUser(args: {
  tenantId: string;
  authUserId: string;
}): Promise<DmSummary[]> {
  const rows = await db
    .select({
      chatId: chat.id,
      chatKind: chat.kind,
      chatTitle: chat.title,
      createdAt: chat.createdAt,
      tenantId: chat.tenantId,
    })
    .from(chatParticipants)
    .innerJoin(chat, eq(chatParticipants.chatId, chat.id))
    .where(
      and(
        eq(chat.tenantId, args.tenantId),
        inArray(chat.kind, ["dm", "group_dm"]),
        eq(chatParticipants.userId, args.authUserId)
      )
    )
    .orderBy(desc(chat.createdAt));

  const summaries: DmSummary[] = [];

  for (const row of rows) {
    const members = await listDmMembersExceptUser({
      authUserId: args.authUserId,
      chatId: row.chatId,
    });

    if (members.length === 0) {
      continue;
    }

    const isGroup = row.chatKind === "group_dm" || members.length > 1;
    const title = isGroup
      ? row.chatTitle.trim() ||
        buildGroupDmTitle(members.map((m) => m.displayName))
      : members[0].displayName;
    const primary = members[0];

    summaries.push({
      createdAt: row.createdAt,
      id: row.chatId,
      isGroup,
      members,
      peerDisplayName: primary.displayName,
      peerEmail: primary.email,
      peerImage: primary.image,
      peerUserId: primary.userId,
      tenantId: row.tenantId,
      title,
    });
  }

  return summaries;
}

export async function listDmMemberPickerOptions(args: {
  tenantId: string;
  authUserId: string;
}) {
  const rows = await db
    .select({
      email: tenantMembers.email,
      image: authUser.image,
      isActive: tenantMembers.isActive,
      userId: tenantMembers.authUserId,
      userName: authUser.name,
    })
    .from(tenantMembers)
    .innerJoin(authUser, eq(tenantMembers.authUserId, authUser.id))
    .where(eq(tenantMembers.tenantId, args.tenantId))
    .orderBy(tenantMembers.email);

  return rows
    .filter((row) => row.isActive && row.userId !== args.authUserId)
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

export async function createOrGetDirectMessage(args: {
  tenantId: string;
  creatorAuthUserId: string;
  creatorTenantUserId: string;
  peerAuthUserId: string;
}): Promise<Chat> {
  if (args.creatorAuthUserId === args.peerAuthUserId) {
    throw new ChatbotError("bad_request:api", "Cannot DM yourself");
  }

  await assertActiveTenantMember({
    authUserId: args.creatorAuthUserId,
    tenantId: args.tenantId,
  });
  await assertActiveTenantMember({
    authUserId: args.peerAuthUserId,
    tenantId: args.tenantId,
  });

  const existing = await findExistingDirectMessage({
    authUserIdA: args.creatorAuthUserId,
    authUserIdB: args.peerAuthUserId,
    tenantId: args.tenantId,
  });
  if (existing) {
    return existing;
  }

  const [peerMember] = await db
    .select({
      email: tenantMembers.email,
      userName: authUser.name,
    })
    .from(tenantMembers)
    .innerJoin(authUser, eq(authUser.id, tenantMembers.authUserId))
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        eq(tenantMembers.authUserId, args.peerAuthUserId)
      )
    )
    .limit(1);

  const peerLabel = peerMember
    ? resolveDisplayName({
        email: peerMember.email,
        userName: peerMember.userName,
      })
    : "Direct message";

  const chatId = generateUUID();
  const now = new Date();

  const [created] = await db
    .insert(chat)
    .values({
      createdAt: now,
      id: chatId,
      kind: "dm",
      knowledgeBaseId: null,
      tenantId: args.tenantId,
      title: peerLabel,
      userId: args.creatorTenantUserId,
    })
    .returning();

  if (!created) {
    throw new ChatbotError("bad_request:database", "Failed to create DM");
  }

  await db.insert(chatParticipants).values([
    {
      addedByUserId: args.creatorAuthUserId,
      chatId,
      role: "owner",
      userId: args.creatorAuthUserId,
    },
    {
      addedByUserId: args.creatorAuthUserId,
      chatId,
      role: "member",
      userId: args.peerAuthUserId,
    },
  ]);

  return created;
}

export async function createGroupDirectMessage(args: {
  tenantId: string;
  creatorAuthUserId: string;
  creatorTenantUserId: string;
  memberAuthUserIds: string[];
}): Promise<Chat> {
  const uniquePeerIds = [
    ...new Set(
      args.memberAuthUserIds.filter((id) => id !== args.creatorAuthUserId)
    ),
  ];

  if (uniquePeerIds.length < 2) {
    throw new ChatbotError(
      "bad_request:api",
      "Group messages need at least two other people"
    );
  }

  await assertActiveTenantMember({
    authUserId: args.creatorAuthUserId,
    tenantId: args.tenantId,
  });

  for (const peerId of uniquePeerIds) {
    await assertActiveTenantMember({
      authUserId: peerId,
      tenantId: args.tenantId,
    });
  }

  const memberRows = await db
    .select({
      email: tenantMembers.email,
      userId: tenantMembers.authUserId,
      userName: authUser.name,
    })
    .from(tenantMembers)
    .innerJoin(authUser, eq(authUser.id, tenantMembers.authUserId))
    .where(
      and(
        eq(tenantMembers.tenantId, args.tenantId),
        inArray(tenantMembers.authUserId, uniquePeerIds)
      )
    );

  const displayNames = memberRows.map((row) =>
    resolveDisplayName({ email: row.email, userName: row.userName })
  );
  const groupTitle = buildGroupDmTitle(displayNames);

  const chatId = generateUUID();
  const now = new Date();

  const [created] = await db
    .insert(chat)
    .values({
      createdAt: now,
      id: chatId,
      kind: "group_dm",
      knowledgeBaseId: null,
      tenantId: args.tenantId,
      title: groupTitle,
      userId: args.creatorTenantUserId,
    })
    .returning();

  if (!created) {
    throw new ChatbotError("bad_request:database", "Failed to create group DM");
  }

  await db.insert(chatParticipants).values([
    {
      addedByUserId: args.creatorAuthUserId,
      chatId,
      role: "owner",
      userId: args.creatorAuthUserId,
    },
    ...uniquePeerIds.map((userId) => ({
      addedByUserId: args.creatorAuthUserId,
      chatId,
      role: "member" as const,
      userId,
    })),
  ]);

  return created;
}

export async function getDmPeerForUser(args: {
  chat: Chat;
  authUserId: string;
}): Promise<{
  peerUserId: string;
  peerDisplayName: string;
  peerEmail: string;
  peerImage: string | null;
} | null> {
  if (!isOneToOneDmChat(args.chat)) {
    return null;
  }

  const [peer] = await db
    .select({
      email: tenantMembers.email,
      image: authUser.image,
      userId: chatParticipants.userId,
      userName: authUser.name,
    })
    .from(chatParticipants)
    .innerJoin(
      tenantMembers,
      eq(tenantMembers.authUserId, chatParticipants.userId)
    )
    .innerJoin(authUser, eq(authUser.id, chatParticipants.userId))
    .where(
      and(
        eq(chatParticipants.chatId, args.chat.id),
        ne(chatParticipants.userId, args.authUserId)
      )
    )
    .limit(1);

  if (!peer) {
    return null;
  }

  return {
    peerDisplayName: resolveDisplayName({
      email: peer.email,
      userName: peer.userName,
    }),
    peerEmail: peer.email,
    peerImage: peer.image,
    peerUserId: peer.userId,
  };
}

export async function getDmConversationContext(args: {
  chat: Chat;
  authUserId: string;
}): Promise<{
  isGroup: boolean;
  title: string;
  dmPeerDisplayName: string | null;
  dmPeerEmail: string | null;
  dmPeerImage: string | null;
  dmPeerUserId: string | null;
  dmMembers: DmMemberSummary[];
} | null> {
  if (!isOneToOneDmChat(args.chat) && !isGroupDmChat(args.chat)) {
    return null;
  }

  const members = await listDmMembersExceptUser({
    authUserId: args.authUserId,
    chatId: args.chat.id,
  });

  if (isGroupDmChat(args.chat) || members.length > 1) {
    const title =
      args.chat.title.trim() ||
      buildGroupDmTitle(members.map((member) => member.displayName));
    return {
      dmMembers: members,
      dmPeerDisplayName: null,
      dmPeerEmail: null,
      dmPeerImage: null,
      dmPeerUserId: null,
      isGroup: true,
      title,
    };
  }

  const peer = members[0];
  if (!peer) {
    return null;
  }

  return {
    dmMembers: [peer],
    dmPeerDisplayName: peer.displayName,
    dmPeerEmail: peer.email,
    dmPeerImage: peer.image,
    dmPeerUserId: peer.userId,
    isGroup: false,
    title: peer.displayName,
  };
}
