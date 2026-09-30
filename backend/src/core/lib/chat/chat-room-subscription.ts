import { auth } from "@/core/lib/auth/server-session";
import { assertChatApiAccess } from "@/core/lib/chat/assert-chat-api-access";
import { assertChatReadable, isRoomChat } from "@/core/lib/chat/chat-access";
import {
  getChatById,
  toTenantUserId,
  withTenantForUser,
} from "@/core/lib/db/queries";
import { isUuid } from "@/shared/utils";

export async function authorizeChatRoomSubscription(chatId: string): Promise<
  | {
      ok: true;
      authUserId: string;
      chatId: string;
      displayName: string;
    }
  | { ok: false; closeCode: number; reason: string }
> {
  if (!isUuid(chatId)) {
    return { closeCode: 4400, ok: false, reason: "Invalid chat id" };
  }

  const session = await auth();
  if (!session?.user?.email) {
    return { closeCode: 4401, ok: false, reason: "Unauthorized" };
  }

  if (
    (await assertChatApiAccess({
      userEmail: session.user.email,
      userId: session.user.id,
    })) === "forbidden"
  ) {
    return { closeCode: 4403, ok: false, reason: "Forbidden" };
  }

  const chat = await withTenantForUser(session.user, () =>
    getChatById({ id: chatId })
  );

  if (!chat) {
    return { closeCode: 4404, ok: false, reason: "Not found" };
  }

  if (!isRoomChat(chat)) {
    return { closeCode: 4403, ok: false, reason: "Forbidden" };
  }

  try {
    await assertChatReadable({
      authUserId: session.user.id,
      chat,
      tenantUserId: toTenantUserId(session.user.id),
    });
  } catch {
    return { closeCode: 4403, ok: false, reason: "Forbidden" };
  }

  const displayName =
    session.user.name?.trim() || session.user.email?.trim() || "Someone";

  return {
    authUserId: session.user.id,
    chatId,
    displayName,
    ok: true,
  };
}
