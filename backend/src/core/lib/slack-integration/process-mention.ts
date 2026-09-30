import { getTenantSlackIntegrationToken } from "@/core/lib/db/slack-integration-queries";
import type { TenantSlackIntegrationSettings } from "@/core/lib/db/tables";
import { renameSlackAgentSession } from "@/core/lib/slack-integration/agent-sessions";
import { stripBotMention } from "@/core/lib/slack-integration/extract-reply";
import { processSlackIntegrationPrompt } from "@/core/lib/slack-integration/process-prompt";
import { resolveSlackReplyContext } from "@/core/lib/slack-integration/reply-context";

export { deliverSlackIntegrationTurnResult } from "@/core/lib/slack-integration/deliver-turn-result";

type SlackMentionEvent = {
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  thread_ts?: string;
};

export async function processSlackIntegrationMention(args: {
  settings: TenantSlackIntegrationSettings;
  event: SlackMentionEvent;
}) {
  const channelId = args.event.channel?.trim();
  const slackUserId = args.event.user?.trim();
  if (!(channelId && slackUserId)) {
    return;
  }

  const replyContext = resolveSlackReplyContext(args.event);
  if (!replyContext) {
    return;
  }

  const prompt = stripBotMention(
    args.event.text ?? "",
    args.settings.botUserId
  );

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
    authErrorsEphemeral: true,
    channelId,
    prompt,
    replyContext,
    settings: args.settings,
    slackUserId,
  });
}
