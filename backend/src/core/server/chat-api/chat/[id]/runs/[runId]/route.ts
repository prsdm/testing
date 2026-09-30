import { requireChatRunAccess } from "@/core/lib/ai/chat-turn-server";
import { canAccessChatWorkflowRun } from "@/core/lib/ai/chat-workflow-access";
import { getChatWorkflowRun, withTenantForUser } from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";

type RouteParams = {
  params: Promise<{ id: string; runId: string }>;
};

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
    return Response.json({
      productStatus: mapping.status,
      runId,
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }
}
