import { notifyChatRoomMessagesChanged } from "@/core/lib/chat/chat-room-bus";
import {
  mergeUserMessageMetadataForPersist,
  messageMetadataHasComposerDisplay,
} from "@/core/lib/chat/message-metadata";
import {
  getMessageById,
  saveMessages,
  updateMessage,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import type { MessageMetadata } from "@/shared/types";

export async function saveChannelHumanMessage(args: {
  chatId: string;
  userMessageId: string;
  text: string;
  authorAuthUserId: string;
  authorDisplayName: string;
  authorEmail?: string | null;
  authorImage?: string | null;
  threadRootMessageId?: string | null;
  composerText?: string | null;
  userMessageMetadata?: MessageMetadata | null;
}) {
  const wireText = args.text.trim();
  const createdAt = new Date();
  const roomAuthor = {
    authorAuthUserId: args.authorAuthUserId,
    authorDisplayName: args.authorDisplayName,
    authorEmail: args.authorEmail ?? undefined,
    authorImage: args.authorImage ?? null,
  };
  const metadata = mergeUserMessageMetadataForPersist({
    createdAt: createdAt.toISOString(),
    incoming: {
      ...(args.userMessageMetadata ?? {}),
      ...(args.composerText?.trim()
        ? { composerText: args.composerText.trim() }
        : {}),
    },
    roomAuthor,
    roomTurn: true,
    wireText,
  });

  const [existing] = await getMessageById({ id: args.userMessageId });
  if (existing) {
    const existingMeta = existing.metadata as MessageMetadata | undefined;
    if (
      args.userMessageMetadata &&
      !messageMetadataHasComposerDisplay(existingMeta)
    ) {
      await updateMessage({
        id: args.userMessageId,
        metadata: mergeUserMessageMetadataForPersist({
          createdAt: existingMeta?.createdAt ?? createdAt.toISOString(),
          existing: existingMeta,
          incoming: args.userMessageMetadata,
          roomAuthor,
          roomTurn: true,
          wireText,
        }),
        parts: [{ text: wireText, type: "text" }],
      });
      notifyChatRoomMessagesChanged({
        chatId: args.chatId,
        threadRootMessageId: args.threadRootMessageId ?? null,
      });
    }
    return;
  }

  const row: DBMessage = {
    attachments: [],
    chatId: args.chatId,
    createdAt,
    id: args.userMessageId,
    metadata,
    parts: [{ text: wireText, type: "text" }] as DBMessage["parts"],
    role: "user",
    threadRootMessageId: args.threadRootMessageId ?? null,
  };

  await saveMessages({ messages: [row] });
  notifyChatRoomMessagesChanged({
    chatId: args.chatId,
    threadRootMessageId: args.threadRootMessageId ?? null,
  });
}
