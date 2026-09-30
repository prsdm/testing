import { slackApi } from "@/core/lib/connectors/providers/slack/api";

type SlackApiUser = {
  id?: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: {
    display_name?: string;
    real_name?: string;
  };
};

function pickSlackUserLabel(member: SlackApiUser) {
  const displayName = member.profile?.display_name?.trim();
  if (displayName) {
    return displayName;
  }
  const realName = member.profile?.real_name?.trim();
  if (realName) {
    return realName;
  }
  return member.name?.trim() || member.id || "Unknown user";
}

export async function resolveSlackUserNames(
  accessToken: string,
  userIds: string[]
): Promise<Map<string, string>> {
  const needed = new Set(userIds.map((id) => id.trim()).filter(Boolean));
  const labels = new Map<string, string>();
  if (needed.size === 0) {
    return labels;
  }

  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { limit: "200" };
    if (cursor) {
      params.cursor = cursor;
    }
    const page = await slackApi<{
      ok: boolean;
      members?: SlackApiUser[];
      response_metadata?: { next_cursor?: string };
    }>("users.list", accessToken, params);

    for (const member of page.members ?? []) {
      if (!member.id || member.deleted || member.is_bot) {
        continue;
      }
      if (needed.has(member.id)) {
        labels.set(member.id, pickSlackUserLabel(member));
        needed.delete(member.id);
      }
    }

    if (needed.size === 0) {
      break;
    }
    cursor = page.response_metadata?.next_cursor?.trim() || undefined;
  } while (cursor);

  return labels;
}

const USER_MENTION_PATTERN = /<@(U[A-Z0-9]+)>/g;

export function collectSlackUserMentionIds(texts: string[]) {
  const userIds = new Set<string>();
  for (const text of texts) {
    if (!text) {
      continue;
    }
    for (const match of text.matchAll(USER_MENTION_PATTERN)) {
      const userId = match[1]?.trim();
      if (userId) {
        userIds.add(userId);
      }
    }
  }
  return [...userIds];
}

export function formatSlackMessageText(
  text: string,
  userNames: Map<string, string>
) {
  if (!text || userNames.size === 0) {
    return text;
  }
  return text.replace(USER_MENTION_PATTERN, (_match, userId: string) => {
    const label = userNames.get(userId);
    return label ? `@${label}` : `<@${userId}>`;
  });
}
