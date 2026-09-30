import { slackApi } from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";

function normalizeChannelName(name: string) {
  return name.trim().replace(/^#/, "").toLowerCase();
}

export async function slackCreateChannel(input: {
  tenantId: string;
  accessToken: string;
  name: string;
  isPrivate?: boolean;
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const name = normalizeChannelName(input.name);
  if (!name) {
    throw new Error("name is required.");
  }
  if (name.length > 80) {
    throw new Error("Channel name must be 80 characters or less.");
  }
  if (!/^[a-z0-9_-]+$/.test(name)) {
    throw new Error(
      "Channel name must be lowercase and contain only letters, numbers, hyphens, and underscores."
    );
  }

  const created = await slackApi<{
    ok: boolean;
    channel?: {
      id?: string;
      name?: string;
      is_private?: boolean;
      is_channel?: boolean;
      created?: number;
      creator?: string;
    };
  }>("conversations.create", input.accessToken, {
    is_private: input.isPrivate ? "true" : "false",
    name,
  });

  const channel = created.channel;
  if (!channel?.id) {
    throw new Error("Slack did not return the created channel id.");
  }

  return {
    channelId: channel.id,
    created: channel.created,
    creator: channel.creator?.trim() || undefined,
    isChannel: Boolean(channel.is_channel),
    isPrivate: Boolean(channel.is_private),
    name: channel.name?.trim() ?? name,
  };
}
