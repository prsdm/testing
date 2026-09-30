import { z } from "zod";
import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { assertChatReadable, isChannelChat } from "@/core/lib/chat/chat-access";
import { notifyChatRoomMessagesChanged } from "@/core/lib/chat/chat-room-bus";
import { serializeMessageMetadata } from "@/core/lib/chat/message-metadata";
import {
  getChatById,
  getMessageById,
  toTenantUserId,
  updateMessageMetadata,
  withTenantForUser,
} from "@/core/lib/db/queries";
import {
  normalizeThreadTags,
  normalizeThreadTitle,
  parseChannelThreadTagCatalog,
  resolveThreadTagsAgainstCatalog,
  threadTagsSchema,
} from "@/shared/chat/thread-tags";
import { ChatbotError } from "@/shared/errors";
import type { MessageMetadata } from "@/shared/types";

const patchSchema = z
  .object({
    chatId: z.string().uuid(),
    messageId: z.string().uuid(),
    threadTags: threadTagsSchema.optional(),
    threadTitle: z.string().max(120).nullable().optional(),
  })
  .refine(
    (data) => data.threadTags !== undefined || data.threadTitle !== undefined,
    { message: "threadTags or threadTitle is required" }
  );

export async function PATCH(request: Request) {
  let chatId: string;
  let messageId: string;
  let threadTagsPatch: ReturnType<typeof normalizeThreadTags> | undefined;
  let threadTitlePatch: string | null | undefined;

  try {
    const parsed = patchSchema.parse(await request.json());
    chatId = parsed.chatId;
    messageId = parsed.messageId;
    threadTagsPatch =
      parsed.threadTags === undefined ? undefined : parsed.threadTags;
    threadTitlePatch = parsed.threadTitle;
  } catch {
    return new ChatbotError(
      "bad_request:api",
      "Parameters chatId, messageId, and threadTags or threadTitle are required."
    ).toResponse();
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
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

  try {
    await withTenantForUser(session.user, async () => {
      const chat = await getChatById({ id: chatId });
      if (!chat) {
        throw new ChatbotError("not_found:chat");
      }
      if (!isChannelChat(chat)) {
        throw new ChatbotError(
          "bad_request:api",
          "Thread tags are only available in channels."
        );
      }

      await assertChatReadable({
        authUserId: session.user.id,
        chat,
        tenantUserId: toTenantUserId(session.user.id),
      });

      const catalog = parseChannelThreadTagCatalog(chat.threadTagCatalog);
      if (threadTagsPatch !== undefined) {
        threadTagsPatch = resolveThreadTagsAgainstCatalog(
          normalizeThreadTags(threadTagsPatch),
          catalog
        );
      }

      const [message] = await getMessageById({ id: messageId });
      if (!message || message.chatId !== chatId) {
        throw new ChatbotError("not_found:chat");
      }
      if (message.threadRootMessageId) {
        throw new ChatbotError(
          "bad_request:api",
          "Tags can only be set on the thread root message."
        );
      }

      const existing = (message.metadata ?? {}) as MessageMetadata;
      const nextMetadata = serializeMessageMetadata({
        ...existing,
        ...(threadTagsPatch === undefined
          ? {}
          : {
              threadTags:
                threadTagsPatch.length > 0 ? threadTagsPatch : undefined,
            }),
        ...(threadTitlePatch === undefined
          ? {}
          : {
              threadTitle:
                threadTitlePatch === null
                  ? undefined
                  : (normalizeThreadTitle(threadTitlePatch) ?? undefined),
            }),
      });

      await updateMessageMetadata({
        id: messageId,
        metadata: nextMetadata,
      });
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }

  notifyChatRoomMessagesChanged({
    chatId,
    threadRootMessageId: messageId,
  });

  return Response.json({
    ok: true,
    threadTitle: threadTitlePatch,
    threadTags: threadTagsPatch,
  });
}
