import { and, eq } from "drizzle-orm";
import { isRoomChat } from "@/core/lib/chat/chat-access";
import { getDb } from "@/core/lib/db/client";
import {
  type Chat,
  chat,
  chatParticipants,
  knowledgeBaseMembers,
  knowledgeBases,
} from "@/core/lib/db/tables";
import { ChatbotError } from "@/shared/errors";

const db = getDb();

export async function getKnowledgeBaseForChannel(chatId: string) {
  const [row] = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.channelChatId, chatId))
    .limit(1);

  return row ?? null;
}

async function syncChannelParticipantsToKnowledgeBase(args: {
  channelChatId: string;
  knowledgeBaseId: string;
  ownerAuthUserId: string;
  addedByUserId: string;
}) {
  const participants = await db
    .select({
      role: chatParticipants.role,
      userId: chatParticipants.userId,
    })
    .from(chatParticipants)
    .where(eq(chatParticipants.chatId, args.channelChatId));

  for (const participant of participants) {
    if (participant.userId === args.ownerAuthUserId) {
      continue;
    }

    const kbRole = participant.role === "owner" ? "editor" : "editor";

    await db
      .insert(knowledgeBaseMembers)
      .values({
        addedByUserId: args.addedByUserId,
        knowledgeBaseId: args.knowledgeBaseId,
        role: kbRole,
        userId: participant.userId,
      })
      .onConflictDoNothing();
  }
}

function roomKnowledgeBaseName(chat: Chat): string {
  const title = chat.title?.trim();
  if (title) {
    return title;
  }
  if (chat.kind === "group_dm") {
    return "Group message";
  }
  if (chat.kind === "dm") {
    return "Direct message";
  }
  return "Channel";
}

function roomKnowledgeBaseDescription(chat: Chat): string {
  const name = roomKnowledgeBaseName(chat);
  if (chat.kind === "channel") {
    return `Files and links for #${name}`;
  }
  if (chat.kind === "group_dm") {
    return `Files and links for ${name}`;
  }
  if (chat.kind === "dm") {
    return `Files and links for ${name}`;
  }
  return `Files and links for ${name}`;
}

export async function createDedicatedChannelKnowledgeBase(args: {
  tenantId: string;
  channelChatId: string;
  channelTitle: string;
  creatorAuthUserId: string;
  description?: string;
}) {
  const name = args.channelTitle.trim();
  const [created] = await db
    .insert(knowledgeBases)
    .values({
      channelChatId: args.channelChatId,
      createdByUserId: args.creatorAuthUserId,
      description: args.description ?? `Files and links for #${name}`,
      name,
      tenantId: args.tenantId,
      updatedAt: new Date(),
    })
    .returning();

  if (!created) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to create channel knowledge base"
    );
  }

  await syncChannelParticipantsToKnowledgeBase({
    addedByUserId: args.creatorAuthUserId,
    channelChatId: args.channelChatId,
    knowledgeBaseId: created.id,
    ownerAuthUserId: args.creatorAuthUserId,
  });

  return created;
}

export async function ensureRoomKnowledgeBase(args: {
  chat: Chat;
  actorAuthUserId: string;
}): Promise<string> {
  if (!isRoomChat(args.chat)) {
    throw new ChatbotError("bad_request:api", "Not a room chat");
  }

  const kbName = roomKnowledgeBaseName(args.chat);
  const kbDescription = roomKnowledgeBaseDescription(args.chat);

  const existingDedicated = await getKnowledgeBaseForChannel(args.chat.id);
  if (existingDedicated) {
    if (args.chat.knowledgeBaseId !== existingDedicated.id) {
      await db
        .update(chat)
        .set({ knowledgeBaseId: existingDedicated.id })
        .where(eq(chat.id, args.chat.id));
    }
    await syncChannelParticipantsToKnowledgeBase({
      addedByUserId: args.actorAuthUserId,
      channelChatId: args.chat.id,
      knowledgeBaseId: existingDedicated.id,
      ownerAuthUserId: existingDedicated.createdByUserId,
    });
    return existingDedicated.id;
  }

  if (args.chat.knowledgeBaseId) {
    const [linked] = await db
      .select()
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, args.chat.knowledgeBaseId))
      .limit(1);

    if (linked && !linked.channelChatId) {
      await db
        .update(knowledgeBases)
        .set({ channelChatId: args.chat.id, updatedAt: new Date() })
        .where(eq(knowledgeBases.id, linked.id));

      await syncChannelParticipantsToKnowledgeBase({
        addedByUserId: args.actorAuthUserId,
        channelChatId: args.chat.id,
        knowledgeBaseId: linked.id,
        ownerAuthUserId: linked.createdByUserId,
      });
      return linked.id;
    }
  }

  const created = await createDedicatedChannelKnowledgeBase({
    channelChatId: args.chat.id,
    channelTitle: kbName,
    creatorAuthUserId: args.actorAuthUserId,
    description: kbDescription,
    tenantId: args.chat.tenantId,
  });

  await db
    .update(chat)
    .set({ knowledgeBaseId: created.id })
    .where(eq(chat.id, args.chat.id));

  return created.id;
}

export async function addChannelMemberToKnowledgeBase(args: {
  channelChatId: string;
  knowledgeBaseId: string;
  ownerAuthUserId: string;
  memberAuthUserId: string;
  addedByUserId: string;
}) {
  if (args.memberAuthUserId === args.ownerAuthUserId) {
    return;
  }

  await db
    .insert(knowledgeBaseMembers)
    .values({
      addedByUserId: args.addedByUserId,
      knowledgeBaseId: args.knowledgeBaseId,
      role: "editor",
      userId: args.memberAuthUserId,
    })
    .onConflictDoNothing();
}

export async function removeChannelMemberFromKnowledgeBase(args: {
  knowledgeBaseId: string;
  memberAuthUserId: string;
  ownerAuthUserId: string;
}) {
  if (args.memberAuthUserId === args.ownerAuthUserId) {
    return;
  }

  await db
    .delete(knowledgeBaseMembers)
    .where(
      and(
        eq(knowledgeBaseMembers.knowledgeBaseId, args.knowledgeBaseId),
        eq(knowledgeBaseMembers.userId, args.memberAuthUserId)
      )
    );
}

export function ensureChannelKnowledgeBase(args: {
  chat: Chat;
  actorAuthUserId: string;
}): Promise<string> {
  return ensureRoomKnowledgeBase(args);
}

export async function resolveChannelKnowledgeBaseId(args: {
  chat: Chat;
  actorAuthUserId: string;
}): Promise<string | null> {
  if (!isRoomChat(args.chat)) {
    return args.chat.knowledgeBaseId;
  }

  try {
    return await ensureRoomKnowledgeBase({
      actorAuthUserId: args.actorAuthUserId,
      chat: args.chat,
    });
  } catch {
    return args.chat.knowledgeBaseId;
  }
}
