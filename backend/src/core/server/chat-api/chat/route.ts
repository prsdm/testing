import { z } from "zod";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { assertChatOwner, isRoomChat } from "@/core/lib/chat/chat-access";
import {
  deleteChatById,
  getChatById,
  toTenantUserId,
  updateChatKnowledgeBaseById,
  updateChatTitleById,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";
import { isUuid } from "@/shared/utils";

const patchChatSchema = z
  .object({
    knowledgeBaseId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .refine(
    (body) => body.title !== undefined || body.knowledgeBaseId !== undefined,
    {
      message: "At least one field is required",
    }
  );

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!(id && isUuid(id))) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
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

  const chat = await withTenantForUser(session.user, async () =>
    getChatById({ id })
  );

  if (!chat) {
    return new ChatbotError("not_found:chat").toResponse();
  }
  try {
    await assertChatOwner({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  const deletedChat = await withTenantForUser(session.user, async () =>
    deleteChatById({ id })
  );

  return Response.json(deletedChat, { status: 200 });
}

export async function PATCH(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!(id && isUuid(id))) {
    return new ChatbotError("bad_request:api").toResponse();
  }

  let body: z.infer<typeof patchChatSchema>;
  try {
    body = patchChatSchema.parse(await request.json());
  } catch {
    return new ChatbotError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatbotError("unauthorized:chat").toResponse();
  }
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

  const chatRecord = await withTenantForUser(session.user, async () =>
    getChatById({ id })
  );

  if (!chatRecord) {
    return new ChatbotError("not_found:chat").toResponse();
  }

  try {
    await assertChatOwner({
      authUserId: session.user.id,
      chat: chatRecord,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return new ChatbotError("forbidden:chat").toResponse();
  }

  if (isRoomChat(chatRecord) && body.knowledgeBaseId !== undefined) {
    return new ChatbotError(
      "bad_request:api",
      "Knowledge base cannot be changed for this conversation"
    ).toResponse();
  }

  await withTenantForUser(session.user, async () => {
    if (body.title !== undefined) {
      await updateChatTitleById({ chatId: id, title: body.title });
    }
    if (body.knowledgeBaseId !== undefined) {
      await updateChatKnowledgeBaseById({
        chatId: id,
        knowledgeBaseId: body.knowledgeBaseId,
      });
    }
  });

  return Response.json({
    id,
    ...(body.title === undefined ? {} : { title: body.title }),
    ...(body.knowledgeBaseId === undefined
      ? {}
      : { knowledgeBaseId: body.knowledgeBaseId }),
  });
}
