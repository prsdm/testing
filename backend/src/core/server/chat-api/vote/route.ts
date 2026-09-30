import { z } from "zod";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { assertChatReadable } from "@/core/lib/chat/chat-access";
import {
  getChatById,
  getVotesByChatId,
  toTenantUserId,
  voteMessage,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";

async function requireVoteAccess(session: {
  user: { id: string; email?: string | null };
}) {
  if (!session.user.email) {
    return new ChatbotError("unauthorized:vote").toResponse();
  }
  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return new ChatbotError("forbidden:vote").toResponse();
  }
  return null;
}

const voteSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
  type: z.enum(["up", "down"]),
});

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
    return new ChatbotError("unauthorized:vote").toResponse();
  }
  const voteDenied = await requireVoteAccess(session);
  if (voteDenied) {
    return voteDenied;
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
    return new ChatbotError("forbidden:vote").toResponse();
  }

  const votes = await withTenantForUser(session.user, async () =>
    getVotesByChatId({ id: chatId })
  );

  return Response.json(votes, { status: 200 });
}

export async function PATCH(request: Request) {
  let chatId: string;
  let messageId: string;
  let type: "up" | "down";

  try {
    const parsed = voteSchema.parse(await request.json());
    chatId = parsed.chatId;
    messageId = parsed.messageId;
    type = parsed.type;
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "Parameters chatId, messageId, and type are required."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:vote").toResponse();
  }
  const voteDenied = await requireVoteAccess(session);
  if (voteDenied) {
    return voteDenied;
  }

  const chat = await withTenantForUser(session.user, async () =>
    getChatById({ id: chatId })
  );

  if (!chat) {
    return new ChatbotError("not_found:vote").toResponse();
  }

  try {
    await assertChatReadable({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return new ChatbotError("forbidden:vote").toResponse();
  }

  await withTenantForUser(session.user, async () =>
    voteMessage({
      chatId,
      messageId,
      type,
    })
  );

  return new Response("Message voted", { status: 200 });
}
