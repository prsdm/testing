import { z } from "zod";
import {
  prepareChatToolRerunContext,
  requireChatRunAccess,
} from "@/core/lib/ai/chat-turn-server";
import { canAccessChatWorkflowRun } from "@/core/lib/ai/chat-workflow-access";
import { rerunToolPart } from "@/core/lib/ai/rerun-tool-part";
import {
  getLatestChatWorkflowRunForAssistantMessage,
  getMessageById,
  resetToolExecutionLedgerEntry,
  updateChatWorkflowRunStatus,
  updateMessage,
  withTenantForUser,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import {
  applyConnectorToolRerunToMessages,
  applyToolRetryToMessages,
} from "@/shared/chat/apply-tool-retry-response";
import {
  isToolTerminalForRetry,
  toolRetryNeedsApproval,
} from "@/shared/chat/tool-retry-eligibility";
import { normalizeChatMessageParts } from "@/shared/chat/workflow-tool-parts";
import { ChatbotError } from "@/shared/errors";
import type { ChatMessagePart, MessageMetadata } from "@/shared/types";

const bodySchema = z.object({
  assistantMessageId: z.string().uuid(),
  toolCallId: z.string().min(1),
});

type RouteParams = {
  params: Promise<{ id: string; runId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: chatId } = await params;
    const body = bodySchema.parse(await request.json());
    const access = await requireChatRunAccess(chatId);
    const mapping = await withTenantForUser(access.session.user, () =>
      getLatestChatWorkflowRunForAssistantMessage(body.assistantMessageId)
    );

    if (
      !canAccessChatWorkflowRun(mapping, {
        authUserId: access.session.user.id,
        chatId,
      })
    ) {
      throw new ChatbotError("not_found:chat", "Workflow run not found");
    }

    const workflowRunId = mapping.workflowRunId;

    const [assistant] = await withTenantForUser(access.session.user, () =>
      getMessageById({ id: body.assistantMessageId })
    );
    if (!assistant) {
      throw new ChatbotError("not_found:chat", "Assistant message not found");
    }

    const currentMessage = {
      id: assistant.id,
      metadata: (assistant.metadata as MessageMetadata | undefined) ?? {},
      parts: normalizeChatMessageParts(
        (assistant.parts as ChatMessagePart[] | undefined) ?? []
      ),
      role: "assistant" as const,
    };

    const toolPart = currentMessage.parts.find(
      (part) =>
        "toolCallId" in part &&
        part.toolCallId === body.toolCallId &&
        isToolTerminalForRetry(part)
    );
    if (!toolPart || !("toolCallId" in toolPart)) {
      throw new ChatbotError(
        "bad_request:api",
        "Tool call not found for retry"
      );
    }

    const toolName = toolPart.type.startsWith("tool-")
      ? toolPart.type.slice("tool-".length)
      : "";

    await withTenantForUser(access.session.user, () =>
      resetToolExecutionLedgerEntry({
        toolCallId: body.toolCallId,
        workflowRunId,
      })
    );

    if (toolRetryNeedsApproval(toolName)) {
      const updated = applyToolRetryToMessages([currentMessage], {
        assistantMessageId: body.assistantMessageId,
        toolCallId: body.toolCallId,
      })[0];

      if (
        !updated ||
        updated.metadata?.pendingToolApproval?.toolCallId !== body.toolCallId
      ) {
        throw new ChatbotError(
          "bad_request:api",
          "Tool call not found for retry"
        );
      }

      await withTenantForUser(access.session.user, async () => {
        await updateMessage({
          id: body.assistantMessageId,
          metadata: {
            ...updated.metadata,
            workflowRunId,
            workflowRunStatus: "suspended",
          },
          parts: updated.parts as DBMessage["parts"],
        });

        await updateChatWorkflowRunStatus({
          status: "suspended",
          workflowRunId,
        });
      });

      return Response.json({
        approvalId: updated.metadata?.pendingToolApproval?.approvalId,
        assistantMessageId: body.assistantMessageId,
        mode: "approval",
        toolCallId: body.toolCallId,
        workflowRunId,
      });
    }

    const toolContext = await prepareChatToolRerunContext({
      assistantMessageId: body.assistantMessageId,
      chatId,
      sessionUser: access.session.user,
      tenantId: access.tenantId,
      tenantSlug: access.tenantSlug,
      tenantUserId: access.tenantUserId,
      workflowRunId,
    });

    const rerunPart = await rerunToolPart({
      part: toolPart,
      tenantId: access.tenantId,
      tenantSlug: access.tenantSlug,
      toolContext,
      userId: access.session.user.id,
      workflowRunId,
    });

    const updated = applyConnectorToolRerunToMessages([currentMessage], {
      assistantMessageId: body.assistantMessageId,
      nextPart: rerunPart,
      toolCallId: body.toolCallId,
    })[0];

    if (!updated) {
      throw new ChatbotError(
        "bad_request:api",
        "Tool call not found for retry"
      );
    }

    await withTenantForUser(access.session.user, async () => {
      await updateMessage({
        id: body.assistantMessageId,
        metadata: {
          ...updated.metadata,
          workflowRunId,
          workflowRunStatus: "running",
        },
        parts: updated.parts as DBMessage["parts"],
      });

      await updateChatWorkflowRunStatus({
        status: "running",
        workflowRunId,
      });
    });

    return Response.json({
      assistantMessageId: body.assistantMessageId,
      continue: true,
      metadata: updated.metadata,
      mode: "executed",
      parts: updated.parts,
      toolCallId: body.toolCallId,
      workflowRunId,
    });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    if (error instanceof z.ZodError) {
      return new ChatbotError(
        "bad_request:api",
        error.issues.map((issue) => issue.message).join("; ")
      ).toResponse();
    }
    throw error;
  }
}
