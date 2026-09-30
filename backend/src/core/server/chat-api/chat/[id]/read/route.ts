import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { isRoomChat } from "@/core/lib/chat/chat-access";
import { notifyUserChatInbox } from "@/core/lib/chat/chat-inbox-bus";
import { markChatReadForUser } from "@/core/lib/chat/chat-unread";
import {
  getChatById,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { isUuid } from "@/shared/utils";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: chatId } = await params;
  if (!isUuid(chatId)) {
    return Response.json({ error: "Invalid chat id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const chat = await withTenantForUser(session.user, () =>
    getChatById({ id: chatId })
  );

  if (!chat) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!isRoomChat(chat)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const readAt = await markChatReadForUser({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
    notifyUserChatInbox(session.user.id, {
      chatId,
      type: "unread.changed",
    });
    return Response.json({ ok: true, readAt: readAt.toISOString() });
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
}
