import { setSlackIntegrationThreadPendingApprovalMessageTs } from "@/core/lib/db/slack-integration-thread-queries";
import {
  buildSlackIntegrationApprovalBlocks,
  buildSlackIntegrationApprovalFallbackText,
} from "@/core/lib/slack-integration/approval-blocks";
import type { SlackChatTurnResult } from "@/core/lib/slack-integration/execute-chat-turn";
import {
  extractAssistantReplyText,
  extractLibraryFileIds,
  extractPendingApproval,
} from "@/core/lib/slack-integration/extract-reply";
import { buildSlackReplyPresentation } from "@/core/lib/slack-integration/format-slack-reply";
import { slackIntegrationPostThreadReply } from "@/core/lib/slack-integration/post-thread-reply";
import { slackIntegrationUploadDeliverables } from "@/core/lib/slack-integration/upload-deliverable";
import { collectCitationsFromMessageParts } from "@/shared/search/citations";

export async function deliverSlackIntegrationTurnResult(args: {
  botToken: string;
  tenantId: string;
  tenantUserId: string;
  channelId: string;
  conversationKey: string;
  replyThreadTs?: string | null;
  deliverablesEnabled: boolean;
  turn: SlackChatTurnResult;
}) {
  const pending = extractPendingApproval(args.turn.parts, args.turn.metadata);
  if (pending?.approvalId && pending.toolName) {
    const blocks = buildSlackIntegrationApprovalBlocks({
      payload: {
        approvalId: pending.approvalId,
        assistantMessageId: args.turn.assistantMessageId,
        channelId: args.channelId,
        chatId: args.turn.chatId,
        replyThreadTs: args.replyThreadTs,
        tenantId: args.tenantId,
        threadTs: args.conversationKey,
        toolName: pending.toolName,
        workflowRunId: args.turn.workflowRunId,
      },
      toolArgs: pending.args,
      toolName: pending.toolName,
    });

    const posted = await slackIntegrationPostThreadReply({
      blocks,
      botToken: args.botToken,
      channelId: args.channelId,
      text: buildSlackIntegrationApprovalFallbackText({
        toolArgs: pending.args,
        toolName: pending.toolName,
      }),
      threadTs: args.replyThreadTs,
    });
    if (posted.ts) {
      await setSlackIntegrationThreadPendingApprovalMessageTs({
        pendingApprovalMessageTs: posted.ts,
        slackChannelId: args.channelId,
        slackThreadTs: args.conversationKey,
        tenantId: args.tenantId,
      });
    }
    return;
  }

  const presentation = buildSlackReplyPresentation(
    extractAssistantReplyText(args.turn.parts),
    collectCitationsFromMessageParts(args.turn.parts)
  );
  await slackIntegrationPostThreadReply({
    blocks: presentation?.blocks,
    botToken: args.botToken,
    channelId: args.channelId,
    text:
      presentation?.text ??
      "Sorry — I couldn't generate a reply. Try again or use the Kimiro web app.",
    threadTs: args.replyThreadTs,
  });

  if (args.deliverablesEnabled) {
    const libraryFileIds = extractLibraryFileIds(args.turn.parts);
    if (libraryFileIds.length > 0) {
      await slackIntegrationUploadDeliverables({
        botToken: args.botToken,
        channelId: args.channelId,
        libraryFileIds,
        tenantId: args.tenantId,
        tenantUserId: args.tenantUserId,
        threadTs: args.replyThreadTs,
      });
    }
  }
}
