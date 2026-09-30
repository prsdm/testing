import { slackApi } from "@/core/lib/connectors/providers/slack/api";
import { SLACK_MESSAGE_MAX_LEN } from "@/core/lib/slack-integration/format-slack-reply";

export function slackIntegrationPostThreadReply(args: {
  botToken: string;
  channelId: string;
  /** Omit for channel-level replies; set when replying inside a Slack thread. */
  threadTs?: string | null;
  text: string;
  blocks?: Record<string, unknown>[];
}) {
  const text = args.text.trim();
  if (!(text || (args.blocks && args.blocks.length > 0))) {
    throw new Error("Slack reply requires text or blocks.");
  }

  const replyThreadTs = args.threadTs?.trim();

  return slackApi<{ ok: boolean; ts?: string; channel?: string }>(
    "chat.postMessage",
    args.botToken,
    {
      channel: args.channelId,
      ...(replyThreadTs ? { thread_ts: replyThreadTs } : {}),
      ...(text ? { text } : {}),
      ...(args.blocks && args.blocks.length > 0
        ? { blocks: JSON.stringify(args.blocks) }
        : {}),
    }
  );
}

export async function slackIntegrationUpdateThreadMessage(args: {
  botToken: string;
  channelId: string;
  messageTs: string;
  text: string;
  blocks?: Record<string, unknown>[];
}) {
  const text = args.text.trim().slice(0, SLACK_MESSAGE_MAX_LEN);
  if (!(text || (args.blocks && args.blocks.length > 0))) {
    return;
  }

  await slackApi("chat.update", args.botToken, {
    channel: args.channelId,
    ts: args.messageTs,
    ...(text ? { text } : {}),
    ...(args.blocks && args.blocks.length > 0
      ? { blocks: JSON.stringify(args.blocks) }
      : {}),
  });
}

export async function slackIntegrationPostEphemeral(args: {
  botToken: string;
  channelId: string;
  userId: string;
  threadTs?: string;
  text: string;
}) {
  const text = args.text.trim();
  if (!text) {
    return;
  }

  await slackApi("chat.postEphemeral", args.botToken, {
    channel: args.channelId,
    text,
    user: args.userId,
    ...(args.threadTs ? { thread_ts: args.threadTs } : {}),
  });
}
