import { slackApi } from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";
import { resolveSlackChannelId } from "@/core/lib/connectors/providers/slack/list-channels";
import { normalizeSlackMessagesWithUsers } from "@/core/lib/connectors/providers/slack/slack-messages";
import { normalizeSlackMessageTs } from "@/core/lib/connectors/providers/slack/slack-timestamp";

export async function slackGetThreadReplies(input: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  channelId?: string;
  channelName?: string;
  threadTs: string;
  limit?: number;
  cursor?: string;
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const threadTs = normalizeSlackMessageTs(input.threadTs);
  if (!threadTs) {
    throw new Error("threadTs is required.");
  }

  const { channelId, channelName } = await resolveSlackChannelId({
    accessToken: input.accessToken,
    channelId: input.channelId,
    channelName: input.channelName,
  });

  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
  const params: Record<string, string> = {
    channel: channelId,
    limit: String(limit),
    ts: threadTs,
  };
  if (input.cursor?.trim()) {
    params.cursor = input.cursor.trim();
  }

  const page = await slackApi<{
    ok: boolean;
    messages?: Array<{
      type?: string;
      ts?: string;
      user?: string;
      text?: string;
      thread_ts?: string;
      reply_count?: number;
    }>;
    has_more?: boolean;
    response_metadata?: { next_cursor?: string };
  }>("conversations.replies", input.accessToken, params);

  const messages = await normalizeSlackMessagesWithUsers({
    accessToken: input.accessToken,
    channelId,
    messages: page.messages ?? [],
    teamUrl: input.teamUrl,
  });

  const parentMessage =
    messages.find((message) => message.ts === threadTs) ?? messages.at(0);
  const replies = messages.filter(
    (message) => message.ts && message.ts !== threadTs
  );
  const replyCount = replies.length;
  const channelLabel = channelName ? `#${channelName}` : "channel";
  const summary =
    replyCount === 0
      ? `${channelLabel} · no thread replies`
      : `${channelLabel} · ${replyCount} thread repl${replyCount === 1 ? "y" : "ies"}`;

  return {
    channelId,
    channelName,
    hasMore: Boolean(page.has_more),
    messageCount: messages.length,
    messages,
    nextCursor: page.response_metadata?.next_cursor?.trim() || undefined,
    parentMessage,
    replies,
    replyCount,
    summary,
    threadTs,
  };
}
