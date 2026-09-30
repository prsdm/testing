import { getTenantById, toTenantUserId } from "@/core/lib/db/queries";
import { getTenantSlackIntegrationToken } from "@/core/lib/db/slack-integration-queries";
import {
  getSlackIntegrationThreadMapping,
  upsertSlackIntegrationThreadMapping,
} from "@/core/lib/db/slack-integration-thread-queries";
import type { TenantSlackIntegrationSettings } from "@/core/lib/db/tables";
import { setSlackAgentSessionStatus } from "@/core/lib/slack-integration/agent-sessions";
import { deliverSlackIntegrationTurnResult } from "@/core/lib/slack-integration/deliver-turn-result";
import { executeSlackChatTurnWithContinuations } from "@/core/lib/slack-integration/execute-chat-turn";
import {
  slackIntegrationPostEphemeral,
  slackIntegrationPostThreadReply,
} from "@/core/lib/slack-integration/post-thread-reply";
import type { SlackReplyContext } from "@/core/lib/slack-integration/reply-context";
import { resolveKimiroUserForSlack } from "@/core/lib/slack-integration/resolve-kimiro-user";
import { generateUUID } from "@/shared/utils";

export async function processSlackIntegrationPrompt(args: {
  settings: TenantSlackIntegrationSettings;
  channelId: string;
  slackUserId: string;
  prompt: string;
  replyContext: SlackReplyContext;
  /** When set, auth errors are ephemeral instead of a visible thread reply. */
  authErrorsEphemeral?: boolean;
}) {
  const { channelId, slackUserId, replyContext } = args;
  const prompt = args.prompt.trim();
  const replyThreadTs = replyContext.replyThreadTs ?? replyContext.messageTs;
  const agentThreadTs = replyThreadTs;

  const botToken = await getTenantSlackIntegrationToken(args.settings.tenantId);
  if (!botToken) {
    return;
  }

  const tenant = await getTenantById(args.settings.tenantId);
  if (!tenant?.slug) {
    return;
  }

  const kimiroUser = await resolveKimiroUserForSlack({
    botToken,
    slackUserId,
    tenantId: args.settings.tenantId,
  });
  if (!kimiroUser) {
    if (args.authErrorsEphemeral) {
      await slackIntegrationPostEphemeral({
        botToken,
        channelId,
        text: "Your Slack account is not linked to an active Kimiro workspace member. Sign in to Kimiro with the same email Slack exposes, or ask an admin for help.",
        threadTs: replyThreadTs,
        userId: slackUserId,
      });
    } else {
      await slackIntegrationPostThreadReply({
        botToken,
        channelId,
        text: "Your Slack account is not linked to an active Kimiro workspace member. Sign in to Kimiro with the same email Slack exposes, or ask an admin for help.",
        threadTs: agentThreadTs,
      });
    }
    return;
  }

  if (!prompt) {
    await slackIntegrationPostThreadReply({
      botToken,
      channelId,
      text: "What would you like Kimiro to help with?",
      threadTs: replyThreadTs,
    });
    return;
  }

  const existingThread = await getSlackIntegrationThreadMapping({
    slackChannelId: channelId,
    slackThreadTs: replyContext.conversationKey,
    tenantId: args.settings.tenantId,
  });
  const chatId = existingThread?.chatId ?? generateUUID();

  await upsertSlackIntegrationThreadMapping({
    authUserId: kimiroUser.authUserId,
    chatId,
    slackChannelId: channelId,
    slackThreadTs: replyContext.conversationKey,
    tenantId: args.settings.tenantId,
  });

  try {
    await setSlackAgentSessionStatus({
      botToken,
      channelId,
      initiatorUserId: slackUserId,
      status: "processing",
      threadTs: agentThreadTs,
    });
  } catch (error) {
    console.error(
      "[slack-integration] failed to set agent session processing",
      error
    );
  }

  try {
    const turn = await executeSlackChatTurnWithContinuations({
      authUserId: kimiroUser.authUserId,
      chatId,
      email: kimiroUser.email,
      message: prompt,
      name: kimiroUser.name,
      tenantId: args.settings.tenantId,
      tenantSlug: tenant.slug,
    });

    await deliverSlackIntegrationTurnResult({
      botToken,
      channelId,
      conversationKey: replyContext.conversationKey,
      deliverablesEnabled: args.settings.deliverablesEnabled,
      replyThreadTs,
      tenantId: args.settings.tenantId,
      tenantUserId: toTenantUserId(kimiroUser.authUserId),
      turn,
    });
  } catch (error) {
    console.error("[slack-integration] failed to process prompt", error);
    await slackIntegrationPostThreadReply({
      botToken,
      channelId,
      text: "Sorry — Kimiro hit an error on that request. Try again or use the web app.",
      threadTs: replyThreadTs,
    });
  } finally {
    try {
      await setSlackAgentSessionStatus({
        botToken,
        channelId,
        status: "active",
        threadTs: agentThreadTs,
      });
    } catch (error) {
      console.error(
        "[slack-integration] failed to set agent session active",
        error
      );
    }
  }
}
