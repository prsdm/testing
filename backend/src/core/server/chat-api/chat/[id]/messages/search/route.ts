import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { assertChatReadable, isRoomChat } from "@/core/lib/chat/chat-access";
import { searchRoomMessages } from "@/core/lib/chat/room-message-search";
import {
  getChatById,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { isUuid } from "@/shared/utils";

export async function GET(
  request: Request,
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

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

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
    await assertChatReadable({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const hits = await withTenantForUser(session.user, () =>
    searchRoomMessages({
      chatId,
      limit: Number.isFinite(limit) ? limit : undefined,
      query,
      tenantId: chat.tenantId,
    })
  );

  return Response.json({ hits, query });
}
