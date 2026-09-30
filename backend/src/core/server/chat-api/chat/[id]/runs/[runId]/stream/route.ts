import { requireChatRunAccess } from "@/core/lib/ai/chat-turn-server";
import { canAccessChatWorkflowRun } from "@/core/lib/ai/chat-workflow-access";
import { getChatWorkflowRun, withTenantForUser } from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";

export const maxDuration = 300;

type RouteParams = {
  params: Promise<{ id: string; runId: string }>;
};

/** Mid-turn reconnect is served from persisted DB messages after the stream ends. */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: chatId, runId } = await params;
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

    return new ChatbotError(
      "bad_request:api",
      "Live stream reconnect is unavailable. Refresh the chat to load persisted messages."
    ).toResponse();
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }
}
