import {
  slackApi,
  slackMessagePermalink,
} from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";
import {
  openSlackDirectMessageChannel,
  resolveSlackUserByQuery,
} from "@/core/lib/connectors/providers/slack/resolve-user";

export async function slackPostDirectMessage(input: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  user: string;
  text: string;
  blocks?: Record<string, unknown>[];
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const text = input.text.trim();
  if (!text) {
    throw new Error("text is required.");
  }

  const { userId, userName } = await resolveSlackUserByQuery({
    accessToken: input.accessToken,
    query: input.user,
  });

  const channelId = await openSlackDirectMessageChannel({
    accessToken: input.accessToken,
    userId,
  });

  const posted = await slackApi<{
    ok: boolean;
    channel?: string;
    ts?: string;
  }>("chat.postMessage", input.accessToken, {
    channel: channelId,
    text,
    ...(input.blocks && input.blocks.length > 0
      ? { blocks: JSON.stringify(input.blocks) }
      : {}),
  });

  const ts = posted.ts?.trim() ?? "";
  const link = slackMessagePermalink({
    channelId,
    teamUrl: input.teamUrl,
    ts,
  });

  return {
    channelId,
    link,
    text,
    ts: ts || undefined,
    userId,
    userName,
  };
}
