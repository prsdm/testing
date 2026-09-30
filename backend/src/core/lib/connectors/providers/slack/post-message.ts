import {
  slackApi,
  slackMessagePermalink,
} from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";
import { resolveSlackChannelId } from "@/core/lib/connectors/providers/slack/list-channels";

export async function slackPostMessage(input: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  channelId?: string;
  channelName?: string;
  text: string;
  blocks?: Record<string, unknown>[];
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const text = input.text.trim();
  if (!text) {
    throw new Error("text is required.");
  }

  const { channelId, channelName } = await resolveSlackChannelId({
    accessToken: input.accessToken,
    channelId: input.channelId,
    channelName: input.channelName,
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
    channelName,
    link,
    summary: channelName ? `#${channelName}` : "Channel message",
    text,
    ts: ts || undefined,
  };
}
