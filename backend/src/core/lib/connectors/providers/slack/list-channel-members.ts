import { slackApi } from "@/core/lib/connectors/providers/slack/api";

/**
 * List Slack user ids in a channel via conversations.members (paginated).
 */
export async function slackListChannelMemberIds(input: {
  accessToken: string;
  channelId: string;
}): Promise<string[]> {
  const memberIds: string[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string> = {
      channel: input.channelId,
      limit: "200",
    };
    if (cursor) {
      params.cursor = cursor;
    }
    const page = await slackApi<{
      ok: boolean;
      members?: string[];
      response_metadata?: { next_cursor?: string };
    }>("conversations.members", input.accessToken, params);

    for (const memberId of page.members ?? []) {
      const trimmed = memberId.trim();
      if (trimmed) {
        memberIds.push(trimmed);
      }
    }
    cursor = page.response_metadata?.next_cursor?.trim() || undefined;
  } while (cursor);

  return memberIds;
}
