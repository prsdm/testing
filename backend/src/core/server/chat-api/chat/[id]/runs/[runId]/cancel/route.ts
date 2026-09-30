import { z } from "zod";
import { requireChatRunAccess } from "@/core/lib/ai/chat-turn-server";
import { canAccessChatWorkflowRun } from "@/core/lib/ai/chat-workflow-access";
import { cancelChatRunAbort } from "@/core/lib/chat/chat-run-registry";
import {
  getChatWorkflowRun,
  getMessageById,
  updateChatWorkflowRunStatus,
  updateMessage,
  withTenantForUser,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import { sanitizeAssistantPartsForPersistence } from "@/shared/chat/sanitize-assistant-parts-for-persistence";
import { ChatbotError } from "@/shared/errors";
import type { ChatMessagePart } from "@/shared/types";

const bodySchema = z.object({
  clientParts: z.array(z.record(z.string(), z.unknown())).optional(),
});

type RouteParams = {
  params: Promise<{ id: string; runId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: chatId, runId } = await params;
    const body = bodySchema.safeParse(await request.json().catch(() => ({})));
    const clientParts = body.success
      ? (body.data.clientParts as ChatMessagePart[] | undefined)
      : undefined;
    const access = await requireChatRunAccess(chatId);
    const mapping = await withTenantForUser(access.session.user, () =>
      getChatWorkflowRun(runId)
    );
    if (
      !canAccessChatWorkflowRun(mapping, {
        authUserId: access.session.user.id,
        chatId,
      })
    ) {
      throw new ChatbotError("not_found:chat", "Chat run not found");
    }

    cancelChatRunAbort(runId);
    await withTenantForUser(access.session.user, async () => {
      await updateChatWorkflowRunStatus({
        status: "cancelled",
        workflowRunId: runId,
      });
      const [assistant] = await getMessageById({
        id: mapping.assistantMessageId,
      });
      const fallbackParts =
        (assistant?.parts as DBMessage["parts"] | undefined) ??
        ([{ text: "", type: "text" }] as DBMessage["parts"]);
      const nextMetadata = {
        ...(assistant?.metadata && typeof assistant.metadata === "object"
          ? assistant.metadata
          : {}),
        pendingToolApproval: undefined,
        workflowRunId: runId,
        workflowRunStatus: "cancelled" as const,
      };
      const partsToPersist =
        clientParts && clientParts.length > 0
          ? sanitizeAssistantPartsForPersistence(clientParts)
          : fallbackParts;

      try {
        await updateMessage({
          id: mapping.assistantMessageId,
          metadata: nextMetadata,
          parts: partsToPersist as DBMessage["parts"],
        });
      } catch {
        try {
          await updateMessage({
            id: mapping.assistantMessageId,
            metadata: nextMetadata,
            parts: fallbackParts,
          });
        } catch (persistError) {
          console.error(
            "[chat-run-cancel] failed to persist cancelled assistant turn",
            {
              assistantMessageId: mapping.assistantMessageId,
              chatId,
              error: persistError,
              runId,
            }
          );
        }
      }
    });

    return Response.json({ runId, status: "cancelled" });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }
}
