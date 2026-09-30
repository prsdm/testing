import { z } from "zod";
import { requireChatRunAccess } from "@/core/lib/ai/chat-turn-server";
import { canAccessChatWorkflowRun } from "@/core/lib/ai/chat-workflow-access";
import {
  isResolvableToolApprovalPart,
  isResolvedToolApprovalPart,
  resolveAssistantPartsForApproval,
} from "@/core/lib/chat/resolve-assistant-parts-for-approval";
import {
  getChatWorkflowRun,
  getLatestChatWorkflowRunForAssistantMessage,
  getMessageById,
  updateChatWorkflowRunStatus,
  updateMessage,
  withTenantForUser,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import { applyToolApprovalResponseToMessages } from "@/shared/chat/apply-tool-approval-response";
import { ChatbotError } from "@/shared/errors";
import type { ChatMessagePart, MessageMetadata } from "@/shared/types";

const bodySchema = z.object({
  approvalId: z.string().min(1),
  approved: z.boolean(),
  assistantMessageId: z.string().uuid(),
  clientParts: z.array(z.record(z.string(), z.unknown())).optional(),
  reason: z.string().optional(),
});

type RouteParams = {
  params: Promise<{ id: string; runId: string }>;
};

async function resolveWorkflowRunMapping(args: {
  chatId: string;
  authUserId: string;
  runId: string;
  assistantMessageId: string;
}) {
  let mapping = await getChatWorkflowRun(args.runId);
  if (
    !canAccessChatWorkflowRun(mapping, {
      authUserId: args.authUserId,
      chatId: args.chatId,
    }) ||
    mapping?.assistantMessageId !== args.assistantMessageId
  ) {
    mapping = await getLatestChatWorkflowRunForAssistantMessage(
      args.assistantMessageId
    );
  }

  if (
    !canAccessChatWorkflowRun(mapping, {
      authUserId: args.authUserId,
      chatId: args.chatId,
    }) ||
    mapping?.assistantMessageId !== args.assistantMessageId
  ) {
    throw new ChatbotError("not_found:chat", "Workflow run not found");
  }

  return mapping;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: chatId, runId } = await params;
    const body = bodySchema.parse(await request.json());
    const access = await requireChatRunAccess(chatId);
    const mapping = await withTenantForUser(access.session.user, () =>
      resolveWorkflowRunMapping({
        assistantMessageId: body.assistantMessageId,
        authUserId: access.session.user.id,
        chatId,
        runId,
      })
    );
    const resolvedRunId = mapping.workflowRunId;

    const [assistant] = await withTenantForUser(access.session.user, () =>
      getMessageById({ id: body.assistantMessageId })
    );
    if (!assistant) {
      throw new ChatbotError("not_found:chat", "Assistant message not found");
    }

    const mergedParts = resolveAssistantPartsForApproval({
      clientParts: body.clientParts as ChatMessagePart[] | undefined,
      dbParts: (assistant.parts as ChatMessagePart[] | undefined) ?? [],
    });

    const currentMessage = {
      id: assistant.id,
      metadata: (assistant.metadata as MessageMetadata | undefined) ?? {},
      parts: mergedParts,
      role: "assistant" as const,
    };

    const approvalPart = currentMessage.parts.find(
      (part) =>
        "approval" in part &&
        part.approval?.id === body.approvalId &&
        "state" in part
    );

    if (!approvalPart || !("state" in approvalPart)) {
      throw new ChatbotError(
        "bad_request:api",
        "Approval request not found or already resolved"
      );
    }

    if (isResolvedToolApprovalPart(approvalPart)) {
      return Response.json({
        approved: body.approved,
        assistantMessageId: body.assistantMessageId,
        metadata: {
          ...currentMessage.metadata,
          workflowRunId: resolvedRunId,
        },
        parts: currentMessage.parts,
        workflowRunId: resolvedRunId,
      });
    }

    if (!isResolvableToolApprovalPart(approvalPart)) {
      throw new ChatbotError(
        "bad_request:api",
        "Approval request not found or already resolved"
      );
    }

    const updated = applyToolApprovalResponseToMessages([currentMessage], {
      approvalId: body.approvalId,
      approved: body.approved,
      reason: body.reason,
    })[0];

    if (!updated) {
      throw new ChatbotError("bad_request:api", "Approval request not found");
    }

    const nextMetadata: MessageMetadata = {
      ...updated.metadata,
      workflowRunId: resolvedRunId,
      workflowRunStatus: updated.metadata?.pendingToolApproval
        ? "suspended"
        : "running",
    };

    await withTenantForUser(access.session.user, async () => {
      await updateMessage({
        id: body.assistantMessageId,
        metadata: nextMetadata,
        parts: updated.parts as DBMessage["parts"],
      });

      await updateChatWorkflowRunStatus({
        status: nextMetadata.pendingToolApproval ? "suspended" : "running",
        workflowRunId: resolvedRunId,
      });
    });

    return Response.json({
      approved: body.approved,
      assistantMessageId: body.assistantMessageId,
      metadata: nextMetadata,
      parts: updated.parts,
      workflowRunId: resolvedRunId,
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
