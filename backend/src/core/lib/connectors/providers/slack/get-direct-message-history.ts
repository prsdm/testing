import { slackApi } from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";
import {
  openSlackDirectMessageChannel,
  resolveSlackUserByQuery,
} from "@/core/lib/connectors/providers/slack/resolve-user";
import { normalizeSlackMessagesWithUsers } from "@/core/lib/connectors/providers/slack/slack-messages";
import { normalizeSlackTimestamp } from "@/core/lib/connectors/providers/slack/slack-timestamp";

export async function slackGetDirectMessageHistory(input: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  user: string;
  limit?: number;
  cursor?: string;
  oldest?: string;
  latest?: string;
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const { userId, userName } = await resolveSlackUserByQuery({
    accessToken: input.accessToken,
    query: input.user,
  });

  const channelId = await openSlackDirectMessageChannel({
    accessToken: input.accessToken,
    userId,
  });

  const limit = Math.min(Math.max(input.limit ?? 100, 1), 999);
  const oldest = normalizeSlackTimestamp(input.oldest);
  const latest = normalizeSlackTimestamp(input.latest);
  const params: Record<string, string> = {
    channel: channelId,
    limit: String(limit),
  };
  if (input.cursor?.trim()) {
    params.cursor = input.cursor.trim();
  }
  if (oldest) {
    params.oldest = oldest;
  }
  if (latest) {
    params.latest = latest;
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
  }>("conversations.history", input.accessToken, params);

  const messages = await normalizeSlackMessagesWithUsers({
    accessToken: input.accessToken,
    channelId,
    messages: page.messages ?? [],
    teamUrl: input.teamUrl,
  });
  const messageCount = messages.length;
  const summary =
    messageCount === 0
      ? `DM with ${userName} · no messages`
      : `DM with ${userName} · ${messageCount} message${messageCount === 1 ? "" : "s"}`;

  return {
    channelId,
    hasMore: Boolean(page.has_more),
    messageCount,
    messages,
    nextCursor: page.response_metadata?.next_cursor?.trim() || undefined,
    summary,
    timeFilter:
      oldest || latest
        ? { latest: latest ?? null, oldest: oldest ?? null }
        : undefined,
    userId,
    userName,
  };
}
