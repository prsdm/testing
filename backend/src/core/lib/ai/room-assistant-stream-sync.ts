import type { UIMessage } from "ai";
import type { ChatWorkflowInput } from "@/core/lib/ai/chat-workflow-types";
import { isRoomChat } from "@/core/lib/chat/chat-access";
import { notifyChatRoomMessagesChanged } from "@/core/lib/chat/chat-room-bus";
import {
  getChatById,
  getMessageById,
  updateMessage,
  withTenantId,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import { DEFAULT_COMPOSER_ASSISTANT_SLUG } from "@/shared/chat/assistant-brand";
import {
  roomLiveAssistantPartsAreVisible,
  sanitizeAssistantPartsForRoomLiveSync,
} from "@/shared/chat/sanitize-assistant-parts-for-persistence";
import { uiPartsToChatParts } from "@/shared/chat/ui-message-parts";
import { normalizeChatMessageParts } from "@/shared/chat/workflow-tool-parts";
import type { MessageMetadata } from "@/shared/types";

const ROOM_STREAM_FLUSH_MS = 300;

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === "AbortError") ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "AbortError")
  );
}

/** Persist throttled assistant UI for room peers (WebSocket → refetch). */
export function startRoomAssistantStreamSync(args: {
  assistantMessageId: string;
  input: ChatWorkflowInput;
  uiMessageStream: AsyncIterable<UIMessage>;
  workflowRunId: string;
  abortSignal?: AbortSignal;
}): void {
  void (async () => {
    const chat = await withTenantId(args.input.tenantId, () =>
      getChatById({ id: args.input.chatId })
    );
    if (!chat || !isRoomChat(chat)) {
      return;
    }

    const [assistantRow] = await withTenantId(args.input.tenantId, () =>
      getMessageById({ id: args.input.assistantMessageId })
    );
    const threadRootMessageId = assistantRow?.threadRootMessageId ?? null;
    const baseMetadata =
      assistantRow?.metadata && typeof assistantRow.metadata === "object"
        ? (assistantRow.metadata as MessageMetadata)
        : {};

    let lastPersistedSignature = "";
    let lastFlushAt = 0;
    let pendingParts: ReturnType<typeof sanitizeAssistantPartsForRoomLiveSync> =
      [];

    const flush = async (force: boolean) => {
      if (!roomLiveAssistantPartsAreVisible(pendingParts)) {
        return;
      }
      const now = Date.now();
      const signature = JSON.stringify(pendingParts);
      if (!force && now - lastFlushAt < ROOM_STREAM_FLUSH_MS) {
        return;
      }
      if (!force && signature === lastPersistedSignature) {
        return;
      }

      lastFlushAt = now;
      lastPersistedSignature = signature;

      const metadata: MessageMetadata = {
        ...baseMetadata,
        agentSlug: DEFAULT_COMPOSER_ASSISTANT_SLUG,
        modelId: args.input.modelId,
        workflowRunId: args.workflowRunId,
        workflowRunStatus: "running",
      };

      await withTenantId(args.input.tenantId, () =>
        updateMessage({
          id: args.input.assistantMessageId,
          metadata,
          parts: pendingParts as DBMessage["parts"],
        })
      );

      notifyChatRoomMessagesChanged({
        chatId: args.input.chatId,
        threadRootMessageId,
      });
    };

    try {
      for await (const uiMessage of args.uiMessageStream) {
        if (args.abortSignal?.aborted) {
          break;
        }
        if (uiMessage.id !== args.assistantMessageId) {
          continue;
        }
        const normalized = normalizeChatMessageParts(
          uiPartsToChatParts(uiMessage.parts)
        );
        pendingParts = sanitizeAssistantPartsForRoomLiveSync(normalized);
        await flush(false);
      }
      await flush(true);
    } catch (error) {
      if (!isAbortError(error)) {
        console.error("[room-assistant-stream-sync] failed", {
          assistantMessageId: args.input.assistantMessageId,
          chatId: args.input.chatId,
          error,
        });
      }
    }
  })();
}
