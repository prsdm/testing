import { notionFetch } from "@/core/lib/connectors/providers/notion/api";
import { isNotionUuid } from "@/core/lib/connectors/providers/notion/notion-id";

export type NotionWorkspaceUser = {
  id: string;
  name: string;
  email?: string;
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

export function isNotionUserId(value: string) {
  return isNotionUuid(value);
}

export function pickNotionUserMatch(
  users: NotionWorkspaceUser[],
  query: string
): NotionWorkspaceUser | null {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return null;
  }
  if (isNotionUserId(trimmedQuery)) {
    const byId = users.find((user) => user.id === trimmedQuery);
    if (byId) {
      return byId;
    }
    return { id: trimmedQuery, name: trimmedQuery };
  }

  const normalizedQuery = normalizeQuery(trimmedQuery);
  const emailMatches = users.filter(
    (user) => user.email && normalizeQuery(user.email) === normalizedQuery
  );
  if (emailMatches.length === 1) {
    return emailMatches[0];
  }
  if (emailMatches.length > 1) {
    throw new Error(
      `Multiple Notion users match email "${trimmedQuery}". Use a Notion user id instead.`
    );
  }

  const exactNameMatches = users.filter(
    (user) => normalizeQuery(user.name) === normalizedQuery
  );
  if (exactNameMatches.length === 1) {
    return exactNameMatches[0];
  }
  if (exactNameMatches.length > 1) {
    throw new Error(
      `Multiple Notion users match name "${trimmedQuery}". Use email or user id instead.`
    );
  }

  const partialNameMatches = users.filter((user) => {
    const normalizedName = normalizeQuery(user.name);
    return (
      normalizedName.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedName)
    );
  });
  if (partialNameMatches.length === 1) {
    return partialNameMatches[0];
  }
  if (partialNameMatches.length > 1) {
    throw new Error(
      `Multiple Notion users match "${trimmedQuery}". Use full name, email, or user id instead.`
    );
  }

  return null;
}

export async function listNotionWorkspaceUsers(
  accessToken: string
): Promise<NotionWorkspaceUser[]> {
  const users: NotionWorkspaceUser[] = [];
  let cursor: string | undefined;

  while (true) {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) {
      query.set("start_cursor", cursor);
    }
    const response = await notionFetch({
      accessToken,
      path: `/users?${query.toString()}`,
    });
    const payload = (await response.json()) as {
      results?: Array<{
        id?: string;
        type?: string;
        name?: string;
        person?: { email?: string };
      }>;
      has_more?: boolean;
      next_cursor?: string | null;
    };

    for (const user of payload.results ?? []) {
      if (user.type !== "person" || !user.id) {
        continue;
      }
      users.push({
        email: user.person?.email?.trim() || undefined,
        id: user.id,
        name: user.name?.trim() || user.id,
      });
    }

    if (!payload.has_more || !payload.next_cursor) {
      break;
    }
    cursor = payload.next_cursor;
  }

  return users;
}

export async function resolveNotionUserByQuery(input: {
  accessToken: string;
  query: string;
  users?: NotionWorkspaceUser[];
}): Promise<NotionWorkspaceUser> {
  const query = input.query.trim();
  if (!query) {
    throw new Error("Assignee query is empty.");
  }
  if (isNotionUserId(query) && !input.users) {
    return { id: query, name: query };
  }

  const users =
    input.users ?? (await listNotionWorkspaceUsers(input.accessToken));
  const match = pickNotionUserMatch(users, query);
  if (!match) {
    throw new Error(
      `No Notion workspace user found for "${query}". Use a workspace member name, email, or user id.`
    );
  }
  return match;
}
