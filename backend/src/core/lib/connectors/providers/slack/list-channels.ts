import {
  SlackApiError,
  slackApi,
} from "@/core/lib/connectors/providers/slack/api";
import { assertSlackActionAllowed } from "@/core/lib/connectors/providers/slack/auth";

type SlackConversation = {
  id?: string;
  name?: string;
  is_private?: boolean;
  num_members?: number;
};

type SlackChannelInfo = {
  id?: string;
  name?: string;
  is_member?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
};

async function fetchSlackChannelInfo(
  accessToken: string,
  channelId: string
): Promise<SlackChannelInfo | null> {
  try {
    const info = await slackApi<{ ok: boolean; channel?: SlackChannelInfo }>(
      "conversations.info",
      accessToken,
      { channel: channelId }
    );
    return info.channel ?? null;
  } catch (error) {
    if (error instanceof SlackApiError && error.code === "channel_not_found") {
      return null;
    }
    throw error;
  }
}

async function ensureSlackChannelMembership(input: {
  accessToken: string;
  channelId: string;
  channelName?: string | null;
}): Promise<{ channelId: string; channelName: string | null }> {
  const channel = await fetchSlackChannelInfo(
    input.accessToken,
    input.channelId
  );
  if (!channel?.id) {
    throw new SlackApiError("channel_not_found");
  }

  const channelName = channel.name?.trim() || input.channelName?.trim() || null;
  if (channel.is_archived) {
    throw new Error(
      `Slack channel ${channelName ? `#${channelName}` : input.channelId} is archived.`
    );
  }

  if (!channel.is_member) {
    if (channel.is_private) {
      throw new Error(
        `You are not a member of private channel ${channelName ? `#${channelName}` : input.channelId}. Join it in Slack first.`
      );
    }
    await slackApi("conversations.join", input.accessToken, {
      channel: channel.id,
    });
  }

  return { channelId: channel.id, channelName };
}

async function resolveSlackChannelByName(input: {
  accessToken: string;
  channelName: string;
}): Promise<{ channelId: string; channelName: string }> {
  const rawName = input.channelName.trim().replace(/^#/, "");
  if (!rawName) {
    throw new Error("channelId or channelName is required.");
  }

  let cursor: string | undefined;
  do {
    const params: Record<string, string> = {
      exclude_archived: "true",
      limit: "200",
      types: "public_channel,private_channel",
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const page = await slackApi<{
      ok: boolean;
      channels?: SlackConversation[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.list", input.accessToken, params);

    for (const channel of page.channels ?? []) {
      if (channel.id && channel.name === rawName) {
        return { channelId: channel.id, channelName: channel.name };
      }
    }
    cursor = page.response_metadata?.next_cursor?.trim() || undefined;
  } while (cursor);

  throw new Error(
    `Slack channel "#${rawName}" was not found in your workspace. Call slackListChannels to see available channels.`
  );
}

export async function resolveSlackChannelId(input: {
  accessToken: string;
  channelId?: string;
  channelName?: string;
}): Promise<{ channelId: string; channelName: string | null }> {
  const directId = input.channelId?.trim();
  const rawName = input.channelName?.trim().replace(/^#/, "") ?? "";

  if (directId) {
    const info = await fetchSlackChannelInfo(input.accessToken, directId);
    if (info?.id) {
      return ensureSlackChannelMembership({
        accessToken: input.accessToken,
        channelId: info.id,
        channelName: info.name ?? (rawName || null),
      });
    }
    if (rawName) {
      const resolved = await resolveSlackChannelByName({
        accessToken: input.accessToken,
        channelName: rawName,
      });
      return ensureSlackChannelMembership({
        accessToken: input.accessToken,
        channelId: resolved.channelId,
        channelName: resolved.channelName,
      });
    }
    throw new SlackApiError("channel_not_found");
  }

  if (!rawName) {
    throw new Error("channelId or channelName is required.");
  }

  const resolved = await resolveSlackChannelByName({
    accessToken: input.accessToken,
    channelName: rawName,
  });
  return ensureSlackChannelMembership({
    accessToken: input.accessToken,
    channelId: resolved.channelId,
    channelName: resolved.channelName,
  });
}

export async function slackListChannels(input: {
  tenantId: string;
  accessToken: string;
  limit?: number;
  cursor?: string;
}) {
  await assertSlackActionAllowed({ tenantId: input.tenantId });

  const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);
  const params: Record<string, string> = {
    exclude_archived: "true",
    limit: String(limit),
    types: "public_channel,private_channel",
  };
  if (input.cursor?.trim()) {
    params.cursor = input.cursor.trim();
  }

  const page = await slackApi<{
    ok: boolean;
    channels?: SlackConversation[];
    response_metadata?: { next_cursor?: string };
  }>("conversations.list", input.accessToken, params);

  const channels = (page.channels ?? [])
    .filter((channel) => Boolean(channel.id && channel.name))
    .map((channel) => ({
      id: channel.id as string,
      isPrivate: Boolean(channel.is_private),
      memberCount:
        typeof channel.num_members === "number"
          ? channel.num_members
          : undefined,
      name: channel.name as string,
    }));

  return {
    channels,
    nextCursor: page.response_metadata?.next_cursor?.trim() || undefined,
    summary: `${channels.length} channel${channels.length === 1 ? "" : "s"}`,
  };
}
