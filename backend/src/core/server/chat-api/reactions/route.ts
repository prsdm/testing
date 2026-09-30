import { z } from "zod";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { assertChatReadable } from "@/core/lib/chat/chat-access";
import { notifyChatRoomReactionsChanged } from "@/core/lib/chat/chat-room-bus";
import {
  getChatById,
  getMessageReactionsByChatId,
  toggleMessageReaction,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { isAllowedMessageReactionEmoji } from "@/shared/chat/quick-reactions";
import { ChatbotError } from "@/shared/errors";

const emojiSchema = z.string().min(1).max(32);

const toggleSchema = z.object({
  chatId: z.string().uuid(),
  emoji: emojiSchema,
  messageId: z.string().uuid(),
});

async function requireReactionAccess(session: {
  user: { id: string; email?: string | null };
}) {
  if (!session.user.email) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return new ChatbotError("forbidden:chat").toResponse();
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!(chatId && z.string().uuid().safeParse(chatId).success)) {
    return new ChatbotError(
      "bad_request:api",
      "Parameter chatId is required."
    ).toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const denied = await requireReactionAccess(session);
  if (denied) {
    return denied;
  }

  const chat = await withTenantForUser(session.user, async () =>
    getChatById({ id: chatId })
  );
  if (!chat) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  try {
    await assertChatReadable({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const reactions = await withTenantForUser(session.user, async () =>
    getMessageReactionsByChatId({ id: chatId })
  );

  return Response.json(
    reactions.filter((reaction) =>
      isAllowedMessageReactionEmoji(reaction.emoji)
    ),
    { status: 200 }
  );
}

export async function PATCH(request: Request) {
  let chatId: string;
  let messageId: string;
  let emoji: string;

  try {
    const parsed = toggleSchema.parse(await request.json());
    chatId = parsed.chatId;
    messageId = parsed.messageId;
    emoji = parsed.emoji;
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "Parameters chatId, messageId, and emoji are required."
    ).toResponse();
  }

  const session = await auth();
  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
  const denied = await requireReactionAccess(session);
  if (denied) {
    return denied;
  }

  const chat = await withTenantForUser(session.user, async () =>
    getChatById({ id: chatId })
  );
  if (!chat) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  try {
    await assertChatReadable({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  if (!isAllowedMessageReactionEmoji(emoji)) {
    return new ChatbotError(
      "bad_request:api",
      "That reaction is not available."
    ).toResponse();
  }

  const tenantUserId = toTenantUserId(session.user.id);

  await withTenantForUser(session.user, async () =>
    toggleMessageReaction({
      chatId,
      emoji,
      messageId,
      userId: tenantUserId,
    })
  );

  notifyChatRoomReactionsChanged({ chatId, messageId });

  return new Response("Reaction toggled", { status: 200 });
}
