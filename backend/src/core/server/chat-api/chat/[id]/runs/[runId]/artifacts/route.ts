import { requireChatRunAccess } from "@/core/lib/ai/chat-turn-server";
import { canAccessChatWorkflowRun } from "@/core/lib/ai/chat-workflow-access";
import { createArtifactNdjsonTransform } from "@/core/lib/chat/artifact-ndjson-stream";
import { subscribeChatArtifactStream } from "@/core/lib/chat/chat-run-registry";
import { getChatWorkflowRun, withTenantForUser } from "@/core/lib/db/queries";
import { ChatbotError } from "@/shared/errors";

export const maxDuration = 300;

type RouteParams = {
  params: Promise<{ id: string; runId: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
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

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const unsubscribe = subscribeChatArtifactStream(
          runId,
          (part) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(part)}\n`));
          },
          true
        );
        request.signal.addEventListener("abort", () => {
          unsubscribe();
          controller.close();
        });
      },
    });

    return new Response(stream.pipeThrough(createArtifactNdjsonTransform()), {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    throw error;
  }
}
