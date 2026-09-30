import { getTenantSlackIntegrationToken } from "@/core/lib/db/slack-integration-queries";
import type { TenantSlackIntegrationSettings } from "@/core/lib/db/tables";
import {
  renameSlackAgentSession,
  setSlackAgentSuggestedPrompts,
} from "@/core/lib/slack-integration/agent-sessions";
import { slackIntegrationPostThreadReply } from "@/core/lib/slack-integration/post-thread-reply";
import { processSlackIntegrationPrompt } from "@/core/lib/slack-integration/process-prompt";
import { resolveSlackAgentReplyContext } from "@/core/lib/slack-integration/reply-context";

type SlackAgentMessageEvent = {
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
  channel_type?: string;
};

type SlackAssistantThreadStartedEvent = {
  channel?: string;
  thread_ts?: string;
  assistant_thread?: {
    context?: {
      channel_id?: string;
    };
  };
};

export async function processSlackIntegrationAgentMessage(args: {
  settings: TenantSlackIntegrationSettings;
  event: SlackAgentMessageEvent;
}) {
  const channelId = args.event.channel?.trim();
  const slackUserId = args.event.user?.trim();
  if (!(channelId && slackUserId)) {
    return;
  }

  const replyContext = resolveSlackAgentReplyContext(args.event);
  if (!replyContext) {
    return;
  }

  const prompt = args.event.text?.trim() ?? "";
  if (prompt) {
    const title = prompt.split(/\s+/).slice(0, 8).join(" ");
    const botToken = await getTenantSlackIntegrationToken(
      args.settings.tenantId
    );
    if (botToken) {
      try {
        await renameSlackAgentSession({
          botToken,
          channelId,
          threadTs: replyContext.replyThreadTs ?? replyContext.messageTs,
          title,
        });
      } catch {
        // Title is optional UX polish.
      }
    }
  }

  await processSlackIntegrationPrompt({
    channelId,
    prompt,
    replyContext,
    settings: args.settings,
    slackUserId,
  });
}

export async function processSlackIntegrationAssistantThreadStarted(args: {
  settings: TenantSlackIntegrationSettings;
  event: SlackAssistantThreadStartedEvent;
}) {
  const channelId = args.event.channel?.trim();
  const threadTs = args.event.thread_ts?.trim();
  if (!(channelId && threadTs)) {
    return;
  }

  const botToken = await getTenantSlackIntegrationToken(args.settings.tenantId);
  if (!botToken) {
    return;
  }

  await slackIntegrationPostThreadReply({
    botToken,
    channelId,
    text: "Hi — I'm Kimiro, your AI agent. Ask me about knowledge bases, docs, or anything you're working on.",
    threadTs,
  });

  try {
    await setSlackAgentSuggestedPrompts({
      botToken,
      channelId,
      prompts: [
        {
          message: "What do we have in our test knowledge base?",
          title: "Summarize a knowledge base",
        },
        {
          message: "Find the latest notes on our product roadmap.",
          title: "Search company knowledge",
        },
        {
          message:
            "Draft a short update for the team about this week's progress.",
          title: "Draft something",
        },
      ],
      threadTs,
      title: "Try asking:",
    });
  } catch (error) {
    console.error("[slack-integration] failed to set suggested prompts", error);
  }
}
