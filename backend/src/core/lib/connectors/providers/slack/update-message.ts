import {
  slackApi,
  slackMessagePermalink,
} from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";
import { resolveSlackChannelId } from "@/core/lib/connectors/providers/slack/list-channels";

export async function slackUpdateMessage(input: {
  tenantId: string;
  accessToken: string;
  teamUrl: string | null;
  channelId?: string;
  channelName?: string;
  messageTs: string;
  text: string;
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const messageTs = input.messageTs.trim();
  if (!messageTs) {
    throw new Error("messageTs is required.");
  }

  const text = input.text.trim();
  if (!text) {
    throw new Error("text is required.");
  }

  const { channelId, channelName } = await resolveSlackChannelId({
    accessToken: input.accessToken,
    channelId: input.channelId,
    channelName: input.channelName,
  });

  const updated = await slackApi<{
    ok: boolean;
    channel?: string;
    ts?: string;
    text?: string;
  }>("chat.update", input.accessToken, {
    channel: channelId,
    text,
    ts: messageTs,
  });

  const ts = updated.ts?.trim() ?? messageTs;
  const link = slackMessagePermalink({
    channelId,
    teamUrl: input.teamUrl,
    ts,
  });

  return {
    channelId,
    channelName,
    link,
    text: updated.text?.trim() ?? text,
    ts,
  };
}
