import type { UIMessage } from "ai";
import { convertToUIMessages } from "@/core/lib/chat/convert-db-messages-to-ui";
import { getMessagesByChatId } from "@/core/lib/db/queries";

/** Room @Kimiro turns must replay thread-scoped history, not the client’s full channel list. */
export async function loadRoomThreadWorkflowUiMessages(args: {
  chatId: string;
  historyThreadRootMessageId: string;
}): Promise<UIMessage[]> {
  const rows = await getMessagesByChatId({
    id: args.chatId,
    threadRootMessageId: args.historyThreadRootMessageId,
  });
  return convertToUIMessages(rows) as UIMessage[];
}
