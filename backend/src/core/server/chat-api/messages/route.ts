import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { ensureChannelKnowledgeBase } from "@/core/lib/chat/channel-knowledge-base";
import {
  assertChatReadable,
  getChatParticipantRole,
  isChannelChat,
  isDmChat,
  isRoomChat,
} from "@/core/lib/chat/chat-access";
import { convertToUIMessages } from "@/core/lib/chat/convert-db-messages-to-ui";
import { getDmConversationContext } from "@/core/lib/chat/dm-queries";
import { serializeMessageMetadata } from "@/core/lib/chat/message-metadata";
import {
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getMessageById,
  getMessagesByChatId,
  getTenantAccessContextByEmail,
  getThreadReplyCountsByChatId,
  getThreadReplyMessagesByChatId,
  toTenantUserId,
  updateMessage,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { getKnowledgeBaseForUser } from "@/core/lib/knowledge-bases/knowledge-base-queries";
import type { ChatMessage } from "@/shared/types";
import { isUuid } from "@/shared/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");

  if (!(chatId && isUuid(chatId))) {
    return Response.json({ error: "chatId required" }, { status: 400 });
  }

  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!session.user.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const threadRootParam = searchParams.get("threadRootMessageId");
  const threadRootMessageId =
    threadRootParam && isUuid(threadRootParam) ? threadRootParam : undefined;

  const [chat, messages, threadReplyCounts, threadReplyMessages] =
    await withTenantForUser(session.user, async () =>
      Promise.all([
        getChatById({ id: chatId }),
        getMessagesByChatId({
          id: chatId,
          threadRootMessageId,
        }),
        threadRootMessageId
          ? Promise.resolve({})
          : getThreadReplyCountsByChatId(chatId),
        threadRootMessageId
          ? Promise.resolve([])
          : getThreadReplyMessagesByChatId(chatId),
      ])
    );

  if (!chat) {
    return Response.json({
      isReadonly: false,
      knowledgeBase: null,
      messages: [],
      userId: null,
    });
  }

  try {
    await assertChatReadable({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const accessContext = await getTenantAccessContextByEmail(session.user.email);
  const channelParticipantRole = isChannelChat(chat)
    ? await getChatParticipantRole({
        authUserId: session.user.id,
        chatId: chat.id,
      })
    : null;

  let channelKnowledgeBaseId = chat.knowledgeBaseId;
  if (isRoomChat(chat)) {
    channelKnowledgeBaseId = await ensureChannelKnowledgeBase({
      actorAuthUserId: session.user.id,
      chat,
    });
  }

  const knowledgeBase =
    channelKnowledgeBaseId && accessContext?.tenantId
      ? await getKnowledgeBaseForUser({
          knowledgeBaseId: channelKnowledgeBaseId,
          tenantId: accessContext.tenantId,
          userId: session.user.id,
        })
      : null;

  const dmContext = isDmChat(chat)
    ? await getDmConversationContext({
        authUserId: session.user.id,
        chat,
      })
    : null;

  return Response.json({
    channelParticipantRole,
    channelTitle: isChannelChat(chat) ? chat.title : null,
    chatKind: chat.kind,
    dmMembers: dmContext?.dmMembers ?? [],
    dmPeerDisplayName: dmContext?.dmPeerDisplayName ?? null,
    dmPeerEmail: dmContext?.dmPeerEmail ?? null,
    dmPeerImage: dmContext?.dmPeerImage ?? null,
    dmPeerUserId: dmContext?.dmPeerUserId ?? null,
    dmTitle: dmContext?.title ?? null,
    isChannel: isChannelChat(chat),
    isDm: isDmChat(chat),
    isGroupDm: Boolean(dmContext?.isGroup),
    isMultiplayerRoom: isRoomChat(chat),
    isReadonly: false,
    knowledgeBase: knowledgeBase
      ? { id: knowledgeBase.id, name: knowledgeBase.name }
      : null,
    messages: convertToUIMessages(messages),
    threadReplyCounts,
    threadReplyMessages: threadRootMessageId
      ? []
      : convertToUIMessages(threadReplyMessages),
    userId: chat.userId,
  });
}

export async function PATCH(request: Request) {
  let body: {
    id?: string;
    parts?: ChatMessage["parts"];
    metadata?: ChatMessage["metadata"];
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { id, parts, metadata } = body;
  if (!(id && isUuid(id) && parts)) {
    return Response.json({ error: "id and parts required" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await withTenantForUser(session.user, async () => {
      const [message] = await getMessageById({ id });
      if (!message) {
        return;
      }

      const chat = await getChatById({ id: message.chatId });
      if (!chat) {
        throw new Error("forbidden");
      }
      await assertChatReadable({
        authUserId: session.user.id,
        chat,
        tenantUserId: toTenantUserId(session.user.id),
      });

      await deleteMessagesByChatIdAfterTimestamp({
        chatId: message.chatId,
        excludeMessageId: id,
        timestamp: message.createdAt,
      });

      await updateMessage({
        id,
        metadata: serializeMessageMetadata(metadata),
        parts,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "forbidden") {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    throw error;
  }

  return Response.json({ ok: true });
}
