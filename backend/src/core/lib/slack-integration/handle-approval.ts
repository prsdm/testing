import { resolveAssistantPartsForApproval } from "@/core/lib/chat/resolve-assistant-parts-for-approval";
import {
  getMessageById,
  updateChatWorkflowRunStatus,
  updateMessage,
  withTenantId,
} from "@/core/lib/db/queries";
import type { DBMessage } from "@/core/lib/db/schema";
import { claimSlackIntegrationPendingApprovalMessage } from "@/core/lib/db/slack-integration-thread-queries";
import {
  buildSlackIntegrationApprovalResolvedBlocks,
  buildSlackIntegrationApprovalResolvedText,
  decodeSlackIntegrationApprovalPayload,
  resolveSlackIntegrationApprovalDisplayLabel,
  type SlackIntegrationApprovalPayload,
} from "@/core/lib/slack-integration/approval-blocks";
import { executeSlackChatTurnWithContinuations } from "@/core/lib/slack-integration/execute-chat-turn";
import { slackIntegrationUpdateThreadMessage } from "@/core/lib/slack-integration/post-thread-reply";
import { deliverSlackIntegrationTurnResult } from "@/core/lib/slack-integration/process-mention";
import { applyToolApprovalResponseToMessages } from "@/shared/chat/apply-tool-approval-response";
import type { ChatMessagePart, MessageMetadata } from "@/shared/types";

function isApprovalStillPending(args: {
  payload: SlackIntegrationApprovalPayload;
  metadata: MessageMetadata | undefined;
}) {
  const pending = args.metadata?.pendingToolApproval;
  if (!pending) {
    return false;
  }
  if (pending.approvalId && pending.approvalId !== args.payload.approvalId) {
    return false;
  }
  return args.metadata?.workflowRunStatus === "suspended";
}

async function applySlackToolApproval(args: {
  payload: SlackIntegrationApprovalPayload;
  approved: boolean;
}) {
  const [assistant] = await withTenantId(args.payload.tenantId, () =>
    getMessageById({ id: args.payload.assistantMessageId })
  );
  if (!assistant) {
    throw new Error("Assistant message not found for Slack approval.");
  }

  const mergedParts = resolveAssistantPartsForApproval({
    dbParts: (assistant.parts as ChatMessagePart[] | undefined) ?? [],
  });
  const currentMessage = {
    id: assistant.id,
    metadata: (assistant.metadata as MessageMetadata | undefined) ?? {},
    parts: mergedParts,
    role: "assistant" as const,
  };

  const [updatedMessage] = applyToolApprovalResponseToMessages(
    [currentMessage],
    {
      approvalId: args.payload.approvalId,
      approved: args.approved,
      reason: args.approved ? undefined : "Rejected in Slack",
    }
  );

  await withTenantId(args.payload.tenantId, async () => {
    await updateMessage({
      id: args.payload.assistantMessageId,
      metadata: {
        ...updatedMessage.metadata,
        pendingToolApproval: undefined,
        workflowRunStatus: args.approved ? "running" : "success",
      },
      parts: updatedMessage.parts as DBMessage["parts"],
    });
    await updateChatWorkflowRunStatus({
      status: args.approved ? "running" : "success",
      workflowRunId: args.payload.workflowRunId,
    });
  });
}

async function resolveSlackApprovalMessage(args: {
  payload: SlackIntegrationApprovalPayload;
  botToken: string;
  approved: boolean;
  displayLabel: string;
  approvalMessageTs: string;
}) {
  await slackIntegrationUpdateThreadMessage({
    blocks: buildSlackIntegrationApprovalResolvedBlocks({
      approved: args.approved,
      displayLabel: args.displayLabel,
    }),
    botToken: args.botToken,
    channelId: args.payload.channelId,
    messageTs: args.approvalMessageTs,
    text: buildSlackIntegrationApprovalResolvedText({
      approved: args.approved,
      displayLabel: args.displayLabel,
    }),
  });
}

export async function handleSlackIntegrationApprovalAction(args: {
  payload: SlackIntegrationApprovalPayload;
  approved: boolean;
  botToken: string;
  tenantSlug: string;
  authUserId: string;
  email: string;
  name: string | null;
  tenantUserId: string;
  deliverablesEnabled: boolean;
}): Promise<boolean> {
  const [assistant] = await withTenantId(args.payload.tenantId, () =>
    getMessageById({ id: args.payload.assistantMessageId })
  );
  if (!assistant) {
    return false;
  }

  const metadata = (assistant.metadata as MessageMetadata | undefined) ?? {};
  const displayLabel = resolveSlackIntegrationApprovalDisplayLabel({
    payload: args.payload,
    toolArgs: metadata.pendingToolApproval?.args,
  });

  const approvalMessageTs = await claimSlackIntegrationPendingApprovalMessage({
    slackChannelId: args.payload.channelId,
    slackThreadTs: args.payload.threadTs,
    tenantId: args.payload.tenantId,
  });
  if (!approvalMessageTs) {
    return false;
  }

  if (!isApprovalStillPending({ metadata, payload: args.payload })) {
    await resolveSlackApprovalMessage({
      approvalMessageTs,
      approved: args.approved,
      botToken: args.botToken,
      displayLabel,
      payload: args.payload,
    });
    return false;
  }

  await applySlackToolApproval({
    approved: args.approved,
    payload: args.payload,
  });

  await resolveSlackApprovalMessage({
    approvalMessageTs,
    approved: args.approved,
    botToken: args.botToken,
    displayLabel,
    payload: args.payload,
  });

  if (!args.approved) {
    return true;
  }

  const turn = await executeSlackChatTurnWithContinuations({
    assistantMessageId: args.payload.assistantMessageId,
    authUserId: args.authUserId,
    chatId: args.payload.chatId,
    email: args.email,
    isContinuation: true,
    name: args.name,
    tenantId: args.payload.tenantId,
    tenantSlug: args.tenantSlug,
    workflowRunId: args.payload.workflowRunId,
  });

  await deliverSlackIntegrationTurnResult({
    botToken: args.botToken,
    channelId: args.payload.channelId,
    conversationKey: args.payload.threadTs,
    deliverablesEnabled: args.deliverablesEnabled,
    replyThreadTs: args.payload.replyThreadTs,
    tenantId: args.payload.tenantId,
    tenantUserId: args.tenantUserId,
    turn,
  });

  return true;
}

export function parseSlackIntegrationApprovalActionValue(
  value: string | undefined
) {
  return decodeSlackIntegrationApprovalPayload(value);
}
