import { notifyUserChatInbox } from "@/core/lib/chat/chat-inbox-bus";

export async function notifyChatUnreadForRoom(chatId: string) {
  if (!process.env.POSTGRES_URL?.trim()) {
    return;
  }
  const { listChatParticipantAuthUserIds } = await import(
    "@/core/lib/chat/chat-unread"
  );
  const userIds = await listChatParticipantAuthUserIds(chatId);
  for (const authUserId of userIds) {
    notifyUserChatInbox(authUserId, { chatId, type: "unread.changed" });
  }
}
