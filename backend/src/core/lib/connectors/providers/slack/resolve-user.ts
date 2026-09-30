import { slackApi } from "@/core/lib/connectors/providers/slack/api";

type SlackUserProfile = {
  display_name?: string;
  real_name?: string;
  email?: string;
};

type SlackApiUser = {
  id?: string;
  name?: string;
  deleted?: boolean;
  is_bot?: boolean;
  profile?: SlackUserProfile;
};

export type SlackWorkspaceUser = {
  id: string;
  username: string;
  displayName: string;
  realName: string;
  email: string | null;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "");
}

export function looksLikeSlackUserId(value: string) {
  return /^U[A-Z0-9]{8,}$/i.test(value.trim());
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function mapSlackUser(member: SlackApiUser): SlackWorkspaceUser | null {
  if (member.deleted || member.is_bot || !member.id) {
    return null;
  }
  return {
    displayName: member.profile?.display_name?.trim() || "",
    email: member.profile?.email?.trim().toLowerCase() || null,
    id: member.id,
    realName: member.profile?.real_name?.trim() || member.name?.trim() || "",
    username: member.name?.trim() || member.id,
  };
}

export async function listSlackWorkspaceUsers(
  accessToken: string
): Promise<SlackWorkspaceUser[]> {
  const users: SlackWorkspaceUser[] = [];
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
      const mapped = mapSlackUser(member);
      if (mapped) {
        users.push(mapped);
      }
    }
    cursor = page.response_metadata?.next_cursor?.trim() || undefined;
  } while (cursor);
  return users;
}

function userLabel(user: SlackWorkspaceUser) {
  return user.displayName || user.realName || user.username || user.id;
}

function searchValues(user: SlackWorkspaceUser) {
  const values = new Set<string>();
  for (const value of [
    user.displayName,
    user.realName,
    user.username,
    user.email ?? "",
    ...user.realName.split(/\s+/),
  ]) {
    const normalized = normalizeQuery(value);
    if (normalized) {
      values.add(normalized);
    }
  }
  return [...values];
}

export function pickSlackUserMatch(
  users: SlackWorkspaceUser[],
  query: string
): SlackWorkspaceUser | null {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }

  if (looksLikeSlackUserId(trimmedQuery)) {
    const byId = users.find(
      (user) => user.id.toUpperCase() === trimmedQuery.toUpperCase()
    );
    if (byId) {
      return byId;
    }
    return {
      displayName: "",
      email: null,
      id: trimmedQuery,
      realName: "",
      username: trimmedQuery,
    };
  }

  const normalizedQuery = normalizeQuery(trimmedQuery);

  if (looksLikeEmail(trimmedQuery)) {
    const emailMatches = users.filter((user) => user.email === normalizedQuery);
    if (emailMatches.length === 1) {
      return emailMatches[0];
    }
    if (emailMatches.length > 1) {
      throw new Error(
        `Multiple Slack users match email "${trimmedQuery}". Use a Slack user id instead.`
      );
    }
    return null;
  }

  const exactMatches = users.filter((user) =>
    searchValues(user).some((value) => value === normalizedQuery)
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    throw new Error(formatAmbiguousMatch(trimmedQuery, exactMatches));
  }

  const firstNameMatches = users.filter((user) => {
    const firstName = user.realName.split(/\s+/).at(0);
    const displayFirst = user.displayName.split(/\s+/).at(0);
    return (
      (firstName && normalizeQuery(firstName) === normalizedQuery) ||
      (displayFirst && normalizeQuery(displayFirst) === normalizedQuery)
    );
  });
  if (firstNameMatches.length === 1) {
    return firstNameMatches[0];
  }
  if (firstNameMatches.length > 1) {
    throw new Error(formatAmbiguousMatch(trimmedQuery, firstNameMatches));
  }

  const partialMatches = users.filter((user) =>
    searchValues(user).some(
      (value) =>
        value.includes(normalizedQuery) || normalizedQuery.includes(value)
    )
  );
  if (partialMatches.length === 1) {
    return partialMatches[0];
  }
  if (partialMatches.length > 1) {
    throw new Error(formatAmbiguousMatch(trimmedQuery, partialMatches));
  }

  return null;
}

function formatAmbiguousMatch(query: string, users: SlackWorkspaceUser[]) {
  const options = users
    .map((user) => {
      const label = userLabel(user);
      const email = user.email ? ` (${user.email})` : "";
      return `${label}${email}`;
    })
    .join(", ");
  return `Multiple Slack users match "${query}": ${options}. Use full name, @username, or email.`;
}

async function lookupSlackUserByEmail(accessToken: string, email: string) {
  try {
    const lookup = await slackApi<{ ok: boolean; user?: SlackApiUser }>(
      "users.lookupByEmail",
      accessToken,
      { email: email.trim().toLowerCase() }
    );
    const mapped = lookup.user ? mapSlackUser(lookup.user) : null;
    if (!mapped) {
      return null;
    }
    return mapped;
  } catch (error) {
    if (error instanceof Error && error.message.includes("user_not_found")) {
      return null;
    }
    throw error;
  }
}

export async function resolveSlackUserByQuery(input: {
  accessToken: string;
  query: string;
  users?: SlackWorkspaceUser[];
}): Promise<{ userId: string; userName: string }> {
  const query = input.query.trim();
  if (!query) {
    throw new Error("Recipient user is required.");
  }

  if (looksLikeSlackUserId(query) && !input.users) {
    const info = await slackApi<{ ok: boolean; user?: SlackApiUser }>(
      "users.info",
      input.accessToken,
      { user: query }
    );
    const mapped = info.user ? mapSlackUser(info.user) : null;
    if (!mapped) {
      throw new Error(`Slack user "${query}" was not found.`);
    }
    return { userId: mapped.id, userName: userLabel(mapped) };
  }

  const users =
    input.users ?? (await listSlackWorkspaceUsers(input.accessToken));
  let match = pickSlackUserMatch(users, query);

  if (!match && looksLikeEmail(query)) {
    match = await lookupSlackUserByEmail(input.accessToken, query);
  }

  if (!match) {
    throw new Error(
      `No Slack workspace user matched "${query}". Use first name, full name, @username, or run slackListUsers.`
    );
  }

  if (
    !users.some((user) => user.id === match.id) &&
    looksLikeSlackUserId(match.id)
  ) {
    return { userId: match.id, userName: userLabel(match) };
  }

  return { userId: match.id, userName: userLabel(match) };
}

export async function openSlackDirectMessageChannel(input: {
  accessToken: string;
  userId: string;
}) {
  const opened = await slackApi<{
    ok: boolean;
    channel?: { id?: string };
  }>("conversations.open", input.accessToken, {
    users: input.userId,
  });
  const channelId = opened.channel?.id?.trim();
  if (!channelId) {
    throw new Error("Slack did not return a direct message channel.");
  }
  return channelId;
}
